import { config } from "../config.js";

const S3_ENDPOINT = config.s3.endpoint;
const S3_PUBLIC_URL = config.s3.publicUrl;

/**
 * Converts internal S3 URLs (e.g., http://minio:9000) to publicly accessible URLs.
 * This is crucial for environments where the browser cannot reach the internal docker network names.
 */
export function normalizeS3Url(url: string | null | undefined): string | null {
  if (!url) return null;

  // Always ensure we replace internal docker names
  const cleanPublicUrl = S3_PUBLIC_URL.replace(/\/+$/, "");
  
  // Standardize the URL if it contains any known internal s3 hostnames/ports
  // We use a broader regex to catch minio:9000, sori-media:9000, and localhost:9000
  const internalHostsRegex = /^(https?:\/\/)?(minio|sori-media|localhost):9000/g;
  
  if (internalHostsRegex.test(url)) {
    return url.replace(internalHostsRegex, cleanPublicUrl);
  }

  const cleanEndpoint = S3_ENDPOINT.replace(/\/+$/, "");
  if (url.startsWith(cleanEndpoint)) {
    return url.replace(cleanEndpoint, cleanPublicUrl);
  }

  return url;
}
