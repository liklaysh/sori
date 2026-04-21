import ogs from "open-graph-scraper";
import dns from "node:dns/promises";
import { isIP } from "node:net";
import { redis } from "./redis.js";

export interface LinkMetadata {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  url: string;
  isPrivate?: boolean;
}

const CACHE_TTL = 3600; // 1 hour
const PREVIEW_TIMEOUT_MS = 5000;
const PREVIEW_MAX_BYTES = 1024 * 1024;
const MAX_REDIRECTS = 3;

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }

  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 0) return true;
  if (a === 192 && b === 168) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a >= 224) return true;

  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  return normalized === "::"
    || normalized === "::1"
    || normalized.startsWith("fc")
    || normalized.startsWith("fd")
    || normalized.startsWith("fe8")
    || normalized.startsWith("fe9")
    || normalized.startsWith("fea")
    || normalized.startsWith("feb");
}

function isPrivateAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return isPrivateIPv4(address);
  if (version === 6) return isPrivateIPv6(address);
  return true;
}

async function assertPublicHostname(hostname: string) {
  const normalized = hostname.toLowerCase();
  const blockedHostnames = new Set([
    "localhost",
    "localhost.localdomain",
    "0.0.0.0",
    "127.0.0.1",
    "::1",
  ]);

  if (blockedHostnames.has(normalized) || normalized.endsWith(".local")) {
    throw new Error("Private hostname is not allowed");
  }

  if (isIP(normalized)) {
    if (isPrivateAddress(normalized)) {
      throw new Error("Private IP is not allowed");
    }
    return;
  }

  const resolved = await dns.lookup(normalized, { all: true, verbatim: true });
  if (!resolved.length) {
    throw new Error("Host resolution failed");
  }

  if (resolved.some((entry) => isPrivateAddress(entry.address))) {
    throw new Error("Hostname resolves to a private address");
  }
}

/**
 * Basic SSRF protection: block local and private IP ranges
 */
async function validatePreviewUrl(url: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid URL");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only HTTP(S) URLs are allowed");
  }

  await assertPublicHostname(parsed.hostname);
  return parsed;
}

async function readHtmlWithLimit(response: Response): Promise<string> {
  const contentLength = Number(response.headers.get("content-length") || "0");
  if (contentLength > PREVIEW_MAX_BYTES) {
    throw new Error("Preview response is too large");
  }

  if (!response.body) {
    return "";
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    total += value.byteLength;
    if (total > PREVIEW_MAX_BYTES) {
      throw new Error("Preview response exceeded size limit");
    }

    chunks.push(value);
  }

  const buffer = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder("utf-8").decode(buffer);
}

async function fetchPreviewHtml(url: string): Promise<{ html: string; finalUrl: string }> {
  let currentUrl = url;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
    const parsed = await validatePreviewUrl(currentUrl);
    const response = await fetch(parsed.toString(), {
      method: "GET",
      redirect: "manual",
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "SoriLinkPreview/1.0",
      },
      signal: AbortSignal.timeout(PREVIEW_TIMEOUT_MS),
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new Error("Redirect response without location");
      }

      currentUrl = new URL(location, parsed).toString();
      continue;
    }

    if (response.status >= 400) {
      throw new Error(`Preview request failed with status ${response.status}`);
    }

    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    if (contentType && !contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
      throw new Error("Preview target is not an HTML page");
    }

    return {
      html: await readHtmlWithLimit(response),
      finalUrl: parsed.toString(),
    };
  }

  throw new Error("Too many redirects");
}

function resolveMaybeRelativeUrl(value: unknown, baseUrl: string): string | undefined {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return undefined;
  }
}

/**
 * Fetch and parse metadata for a single URL with caching
 */
export async function getSingleLinkPreview(url: string): Promise<LinkMetadata | null> {
  if (!url) return null;

  // 1. Check Redis Cache
  const cacheKey = `link_preview:${url}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (err) {
    console.error("[LinkPreview] Cache error:", err);
  }

  // 2. Scrape Metadata
  try {
    const { html, finalUrl } = await fetchPreviewHtml(url);
    const { result } = await ogs({ html });
    const imageUrl = Array.isArray((result as any).ogImage)
      ? resolveMaybeRelativeUrl((result as any).ogImage?.[0]?.url, finalUrl)
      : resolveMaybeRelativeUrl((result as any).ogImage?.url, finalUrl);
    
    const metadata: LinkMetadata = {
      url: finalUrl,
      title: result.ogTitle || result.twitterTitle || (result as any).title,
      description: result.ogDescription || result.twitterDescription || (result as any).description,
      image: imageUrl || resolveMaybeRelativeUrl((result as any).twitterImage?.[0]?.url, finalUrl),
      siteName: result.ogSiteName || result.twitterSite || (result as any).siteName,
    };

    // 3. Cache Result (even if partial)
    if (metadata.title) {
      await redis.set(cacheKey, JSON.stringify(metadata), "EX", CACHE_TTL);
    }

    return metadata;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Preview Unavailable";
    const isPrivate = message.toLowerCase().includes("private");
    console.error(`[LinkPreview] Failed scraping ${url}:`, err);
    // Cache a failed result briefly to avoid hammering dead links
    await redis.set(cacheKey, JSON.stringify({ url, title: isPrivate ? "Private Network Resource" : "Preview Unavailable", isPrivate }), "EX", 300);
    return {
      url,
      title: isPrivate ? "Private Network Resource" : "Preview Unavailable",
      description: isPrivate ? "This link points to an internal resource and cannot be previewed." : undefined,
      isPrivate,
    };
  }
}

/**
 * Enhanced extractor that handles multiple URLs and limits to 3
 */
export async function getLinkPreviews(text: string): Promise<LinkMetadata[]> {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const matches = Array.from(new Set(text.match(urlRegex) || [])); // Unique URLs
  if (matches.length === 0) return [];

  // Limit to first 3 links to prevent layout bloat
  const targets = matches.slice(0, 3);
  
  const results = await Promise.all(targets.map(url => getSingleLinkPreview(url)));
  return results.filter((r): r is LinkMetadata => r !== null);
}

// Keep the old function for backward compatibility during transition if needed
export async function getLinkPreview(text: string): Promise<LinkMetadata | null> {
  const results = await getLinkPreviews(text);
  return results.length > 0 ? results[0] : null;
}
