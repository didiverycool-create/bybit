import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const defaultControlApiBase = "http://127.0.0.1:8787";
const defaultDevServerUrl = "http://localhost:5173";
const defaultOpenClawGatewayUrl = "ws://127.0.0.1:18789";

const deriveWebSocketOrigin = (httpOrigin) => {
  if (!httpOrigin) {
    return null;
  }
  if (httpOrigin.startsWith("ws://") || httpOrigin.startsWith("wss://")) {
    return httpOrigin;
  }
  if (httpOrigin.startsWith("https://")) {
    return `wss://${httpOrigin.slice("https://".length)}`;
  }
  if (httpOrigin.startsWith("http://")) {
    return `ws://${httpOrigin.slice("http://".length)}`;
  }
  return null;
};

const buildConnectSrcOrigins = () => {
  const controlApiBase = process.env.VITE_CONTROL_API_BASE ?? defaultControlApiBase;
  const devServerUrl = process.env.VITE_DEV_SERVER_URL ?? defaultDevServerUrl;
  const openClawGatewayUrl = process.env.VITE_OPENCLAW_GATEWAY_URL ?? defaultOpenClawGatewayUrl;
  const origins = new Set([
    "'self'",
    defaultControlApiBase,
    defaultDevServerUrl,
    deriveWebSocketOrigin(defaultDevServerUrl) ?? "",
    defaultOpenClawGatewayUrl,
    controlApiBase,
    devServerUrl,
    deriveWebSocketOrigin(devServerUrl) ?? "",
    openClawGatewayUrl,
  ]);
  origins.delete("");
  return Array.from(origins).join(" ");
};

const devContentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  `connect-src ${buildConnectSrcOrigins()}`,
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
