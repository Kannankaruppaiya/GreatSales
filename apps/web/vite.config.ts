/// <reference types="vitest/config" />
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  plugins: [react(), tailwindcss()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
  },
  server: {
    port: 5174,
    // The refresh token is an httpOnly cookie. Proxying /api keeps the browser
    // on ONE origin in dev, exactly as staging does behind its reverse proxy,
    // so the cookie stays first-party and SameSite=Lax works. Without this,
    // dev would need SameSite=None + HTTPS.
    proxy: {
      "/api": {
        target: process.env.VITE_DEV_API_TARGET || "http://localhost:3001",
        changeOrigin: false,
      },
    },
    headers: {
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "SAMEORIGIN",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    },
  },
  build: {
    sourcemap: false, // Prevents production sourcemap leakage (P0 security requirement)
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-icons": ["lucide-react"],
        },
      },
    },
  },
});

