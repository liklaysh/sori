const cleanUrl = (url: string) => url.replace(/\/+$/, "");

// Auto-detect production or use environment variable
const isProd = import.meta.env.PROD || window.location.hostname !== "localhost";
const defaultBaseUrl = isProd ? `${window.location.protocol}//${window.location.host}` : "http://localhost:3000";

export const API_URL = cleanUrl(import.meta.env.VITE_API_URL || defaultBaseUrl);
export const WS_URL = cleanUrl(import.meta.env.VITE_WS_URL || API_URL);
export const MAX_UPLOAD_SIZE_MB = Number(import.meta.env.VITE_MAX_UPLOAD_SIZE_MB || "25");

// Add other global constants here
export const APP_NAME = "Sori";

// LiveKit auto-detect
const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
const livekitHost = import.meta.env.VITE_LIVEKIT_URL || `${protocol}//${window.location.hostname}:7880`;
export const LIVEKIT_URL = cleanUrl(livekitHost);
