import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        // 127.0.0.1, not localhost: macOS resolves localhost to ::1 first,
        // which can silently hit a different server (e.g. a Docker container
        // publishing 8000 on IPv6) instead of a local uvicorn on IPv4.
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
