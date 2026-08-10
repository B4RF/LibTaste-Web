import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target:
          process.env.LIBTASTE_API_PROXY_ORIGIN ?? "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
});
