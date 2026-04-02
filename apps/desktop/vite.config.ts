import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const devContentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  "connect-src 'self' http://127.0.0.1:8787 http://localhost:5173 ws://localhost:5173",
  "worker-src 'self' blob:",
].join("; ");

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": "/src"
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }
          if (id.includes("echarts")) {
            return "charts-vendor";
          }
          return "vendor";
        }
      }
    }
  },
  server: {
    port: 5173,
    headers: {
      "Content-Security-Policy": devContentSecurityPolicy,
    },
  }
});
