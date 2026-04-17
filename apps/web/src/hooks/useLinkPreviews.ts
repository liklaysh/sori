import { useState, useEffect, useRef } from "react";
import { LinkMetadata } from "../types/chat";
import api from "../lib/api";

const URL_REGEX = /(https?:\/\/[^\s]+)/g;
const DEBOUNCE_MS = 500;

export function useLinkPreviews(content: string) {
  const [previews, setPreviews] = useState<Record<string, LinkMetadata | null>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const cache = useRef<Record<string, LinkMetadata | null>>({});
  const pendingRequests = useRef<Set<string>>(new Set());

  useEffect(() => {
    const urls = Array.from(new Set(content.match(URL_REGEX) || [])).slice(0, 3);
    
    if (urls.length === 0) return;

    const timer = setTimeout(() => {
      urls.forEach(async (url) => {
        // Skip if already in cache or being fetched
        if (cache.current[url] || pendingRequests.current.has(url)) {
          if (cache.current[url] && !previews[url]) {
            setPreviews(prev => ({ ...prev, [url]: cache.current[url] }));
          }
          return;
        }

        pendingRequests.current.add(url);
        setLoading(prev => ({ ...prev, [url]: true }));

        try {
          const res = await api.get(`/utils/link-preview?url=${encodeURIComponent(url)}`);

          if (res.status === 200) {
            const data = res.data;
            cache.current[url] = data;
            setPreviews(prev => ({ ...prev, [url]: data }));
          } else {
            cache.current[url] = null;
            setPreviews(prev => ({ ...prev, [url]: null }));
          }
        } catch (error) {
          cache.current[url] = null;
          setPreviews(prev => ({ ...prev, [url]: null }));
        } finally {
          setLoading(prev => ({ ...prev, [url]: false }));
          pendingRequests.current.delete(url);
        }
      });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [content]);

  const removePreview = (url: string) => {
    // Note: This only removes it from the current "live" view in input, 
    // it stays in cache.ref to avoid re-fetching if user pastes it again.
    const newPreviews = { ...previews };
    delete newPreviews[url];
    setPreviews(newPreviews);
  };

  const clearPreviews = () => {
    setPreviews({});
  };

  // Only return previews for URLs actually present in the current content
  const activePreviews = Object.keys(previews)
    .filter(url => content.includes(url))
    .reduce((obj, url) => {
      obj[url] = previews[url];
      return obj;
    }, {} as Record<string, LinkMetadata | null>);

  return {
    previews: activePreviews,
    loading,
    removePreview,
    clearPreviews
  };
}
