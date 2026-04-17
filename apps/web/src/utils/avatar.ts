import { API_URL } from "../config";

/**
 * Standardizes avatar URL resolution.
 * Handles:
 * - Full URLs (e.g. from S3/MinIO)
 * - Relative filenames (legacy local uploads)
 * - Null/Undefined values
 */
export const getAvatarUrl = (path: string | undefined | null): string | null => {
  if (!path) return null;
  
  // If it's already a full URL, return it
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  
  // Otherwise, assume it's a relative path in the uploads directory
  return `${API_URL}/uploads/${path}`;
};
