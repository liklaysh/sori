import ogs from "open-graph-scraper";
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

/**
 * Basic SSRF protection: block local and private IP ranges
 */
function isPrivateUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    
    // Check for common local/private hostnames
    const privateHosts = [
      "localhost",
      "127.0.0.1",
      "::1",
      "0.0.0.0",
    ];
    
    if (privateHosts.includes(hostname)) return true;
    
    // Rough check for RFC1918 private ranges
    // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const match = hostname.match(ipv4Regex);
    if (match) {
      const b1 = parseInt(match[1]);
      const b2 = parseInt(match[2]);
      if (b1 === 10) return true;
      if (b1 === 172 && (b2 >= 16 && b2 <= 31)) return true;
      if (b1 === 192 && b2 === 168) return true;
    }

    return false;
  } catch (e) {
    return true; // If invalid URL, treat as unsafe
  }
}

/**
 * Fetch and parse metadata for a single URL with caching
 */
export async function getSingleLinkPreview(url: string): Promise<LinkMetadata | null> {
  if (!url) return null;
  
  if (isPrivateUrl(url)) {
    return { url, isPrivate: true, title: "Private Network Resource", description: "This link points to an internal resource and cannot be previewed." };
  }

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
    const { result } = await ogs({ url, timeout: 5000 });
    
    const metadata: LinkMetadata = {
      url,
      title: result.ogTitle || result.twitterTitle || (result as any).title,
      description: result.ogDescription || result.twitterDescription || (result as any).description,
      image: (result as any).ogImage?.[0]?.url || (result as any).ogImage?.url || (result as any).twitterImage?.[0]?.url,
      siteName: result.ogSiteName || result.twitterSite || (result as any).siteName,
    };

    // 3. Cache Result (even if partial)
    if (metadata.title) {
      await redis.set(cacheKey, JSON.stringify(metadata), "EX", CACHE_TTL);
    }

    return metadata;
  } catch (err) {
    console.error(`[LinkPreview] Failed scraping ${url}:`, err);
    // Cache a failed result briefly to avoid hammering dead links
    await redis.set(cacheKey, JSON.stringify({ url, title: "Preview Unavailable" }), "EX", 300);
    return { url, title: "Preview Unavailable" };
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
