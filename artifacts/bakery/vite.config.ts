import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { VitePWA } from "vite-plugin-pwa";

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH;

if (!basePath) {
  throw new Error(
    "BASE_PATH environment variable is required but was not provided.",
  );
}

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      strategies: "generateSW",
      includeAssets: ["favicon.svg", "icons/icon.svg"],
      manifest: {
        name: "Ara Bakery Cloud",
        short_name: "Ara Bakery",
        description: "Complete bakery management platform for Nigerian bakeries.",
        start_url: "/dashboard",
        scope: "/",
        display: "standalone",
        orientation: "any",
        background_color: "#fffbeb",
        theme_color: "#f59e0b",
        categories: ["business", "productivity", "food"],
        lang: "en",
        icons: [
          {
            src: "/icons/icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
          {
            src: "/favicon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
        ],
        shortcuts: [
          { name: "Dashboard",      url: "/dashboard",  icons: [{ src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml" }] },
          { name: "Record Sale",    url: "/sales",       icons: [{ src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml" }] },
          { name: "Production Log", url: "/production",  icons: [{ src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml" }] },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,html,svg,woff2,ico,png,webp}"],
        runtimeCaching: [
          {
            urlPattern: /\/api\/(products|branches|users)\b/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "ara-api-static",
              expiration: { maxEntries: 50, maxAgeSeconds: 7 * 86400 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /\/api\/(sales|production|inventory|allocations|returns|reports|dashboard)\b/,
            handler: "NetworkFirst",
            options: {
              cacheName: "ara-api-dynamic",
              expiration: { maxEntries: 200, maxAgeSeconds: 24 * 3600 },
              networkTimeoutSeconds: 6,
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^\/api\//,
            handler: "NetworkFirst",
            options: {
              cacheName: "ara-api-other",
              expiration: { maxEntries: 100, maxAgeSeconds: 86400 },
              networkTimeoutSeconds: 8,
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /images\.unsplash\.com/,
            handler: "CacheFirst",
            options: {
              cacheName: "ara-images-cache",
              expiration: { maxEntries: 60, maxAgeSeconds: 604800 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
