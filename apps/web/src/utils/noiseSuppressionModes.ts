export type NoiseSuppressionMode = "webrtc_basic" | "rnnoise" | "experimental_ai";
export type WebNoiseSuppressionMode = "webrtc_basic" | "rnnoise";

export const DEFAULT_NOISE_SUPPRESSION_MODE: NoiseSuppressionMode = "webrtc_basic";
export const WEB_NOISE_SUPPRESSION_MODES: WebNoiseSuppressionMode[] = ["webrtc_basic", "rnnoise"];

export const isNoiseSuppressionMode = (value: unknown): value is NoiseSuppressionMode => {
  return value === "webrtc_basic" || value === "rnnoise" || value === "experimental_ai";
};

export const isWebNoiseSuppressionMode = (value: unknown): value is WebNoiseSuppressionMode => {
  return value === "webrtc_basic" || value === "rnnoise";
};

export const resolveWebNoiseSuppressionMode = (
  selectedMode?: NoiseSuppressionMode | null,
  fallbackMode?: WebNoiseSuppressionMode | null,
): WebNoiseSuppressionMode => {
  if (isWebNoiseSuppressionMode(selectedMode)) {
    return selectedMode;
  }

  if (isWebNoiseSuppressionMode(fallbackMode)) {
    return fallbackMode;
  }

  return DEFAULT_NOISE_SUPPRESSION_MODE;
};

export const getLiveKitAudioCaptureOptions = (mode: WebNoiseSuppressionMode) => ({
  echoCancellation: true,
  noiseSuppression: mode === "webrtc_basic",
  autoGainControl: true,
});
