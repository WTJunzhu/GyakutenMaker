import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { previewPlugin } from "./preview/vitePreviewPlugin";

export default defineConfig({
  plugins: [react(), previewPlugin()],
  server: {
    port: 5175,
    strictPort: false,
  },
});
