import { config } from "../config.js";

export function normalizeOrigin(value: string | undefined | null) {
  if (!value) {
    return "";
  }

  try {
    const parsed = new URL(value.trim());
    if (parsed.origin !== "null") {
      return parsed.origin;
    }

    // Custom app protocols such as tauri://localhost serialize to "null"
    // in WHATWG URL. Preserve the protocol/host pair so desktop clients can
    // be allowlisted without weakening browser origins globally.
    if (parsed.protocol && parsed.host) {
      return `${parsed.protocol}//${parsed.host}`;
    }
  } catch {
    return "";
  }

  return "";
}

export function getAllowedOrigins() {
  return new Set(
    [
      ...config.cors.allowedOrigins,
      ...config.desktop.allowedOrigins,
      config.public.webUrl,
      config.public.apiUrl,
    ].map(normalizeOrigin).filter(Boolean)
  );
}

export function isDesktopAppOrigin(origin: string | undefined | null) {
  const normalized = normalizeOrigin(origin);
  if (!normalized) {
    return false;
  }

  return config.desktop.allowedOrigins
    .map(normalizeOrigin)
    .filter(Boolean)
    .includes(normalized);
}

export function isAllowedSoriOrigin(origin: string | undefined | null) {
  const normalized = normalizeOrigin(origin);
  if (!normalized) {
    return false;
  }

  try {
    const parsed = new URL(normalized);
    const hostname = parsed.hostname.toLowerCase();

    return getAllowedOrigins().has(normalized)
      || hostname === "localhost"
      || hostname === "127.0.0.1"
      || hostname === "sori.orb.local"
      || hostname.endsWith(".sori.orb.local");
  } catch {
    return false;
  }
}
