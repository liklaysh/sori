const env = import.meta.env;

export const WEB_CLIENT_VERSION = env.VITE_SORI_VERSION || "dev";
export const WEB_CLIENT_BUILD_ID = env.VITE_SORI_BUILD_ID || env.VITE_SORI_COMMIT || "dev";
export const WEB_CLIENT_COMMIT = env.VITE_SORI_COMMIT || WEB_CLIENT_BUILD_ID;
export const LIVEKIT_CLIENT_VERSION = "unknown";

export function getWebClientSignal() {
  return {
    clientType: "web",
    appVersion: WEB_CLIENT_VERSION,
    buildId: WEB_CLIENT_BUILD_ID,
    commit: WEB_CLIENT_COMMIT,
    livekitClientVersion: LIVEKIT_CLIENT_VERSION,
    platform: navigator.platform || "web",
    userAgent: navigator.userAgent,
  };
}

export function isComparableBuild(value: string | null | undefined) {
  return Boolean(value && value !== "unknown" && value !== "dev");
}
