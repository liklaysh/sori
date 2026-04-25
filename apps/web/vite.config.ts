import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 5000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("@shiguredo/rnnoise-wasm") || id.includes("/src/utils/noise-processor")) {
            return "noise-processor";
          }

          if (id.includes("emoji-picker-react")) {
            return "emoji-picker-react";
          }

          if (id.includes("@livekit") || id.includes("livekit-client")) {
            return "livekit";
          }

          if (id.includes("react-router-dom") || id.includes("/react/") || id.includes("/react-dom/") || id.includes("zustand")) {
            return "react-core";
          }

          if (id.includes("axios") || id.includes("sonner") || id.includes("date-fns")) {
            return "app-vendor";
          }
        },
      },
    },
  },
});
