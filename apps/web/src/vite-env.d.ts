/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_WS_URL: string;
  readonly VITE_LIVEKIT_URL: string;
  readonly VITE_MAX_UPLOAD_SIZE_MB: string;
  readonly VITE_BUILD_ID: string;
  readonly VITE_BUILD_TIME: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
