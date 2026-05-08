import { createServer } from "node:http";
import { request as httpRequest } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const PUBLIC_DIR = join(__dirname, "dist/public");
const PORT = parseInt(process.env["PORT"] ?? "3000", 10);
const API_PORT = parseInt(process.env["API_PORT"] ?? "8080", 10);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".webp": "image/webp",
  ".webmanifest": "application/manifest+json",
};

// Headers that must NOT be forwarded when proxying (hop-by-hop headers)
const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
]);

function buildProxyHeaders(reqHeaders) {
  const out = {};
  for (const [key, value] of Object.entries(reqHeaders)) {
    if (!HOP_BY_HOP.has(key.toLowerCase()) && key.toLowerCase() !== "host") {
      out[key] = value;
    }
  }
  // Let Node set Host automatically as localhost:API_PORT
  return out;
}

const server = createServer((req, res) => {
  try {
    const urlPath = (req.url ?? "/").split("?")[0];

    // Proxy /api requests to the API server
    if (urlPath.startsWith("/api")) {
      const proxyHeaders = buildProxyHeaders(req.headers);

      const proxyReq = httpRequest(
        {
          hostname: "localhost",
          port: API_PORT,
          path: req.url,
          method: req.method,
          headers: proxyHeaders,
        },
        (proxyRes) => {
          // Strip hop-by-hop headers from the API response before forwarding
          const responseHeaders = {};
          for (const [key, value] of Object.entries(proxyRes.headers)) {
            if (!HOP_BY_HOP.has(key.toLowerCase())) {
              responseHeaders[key] = value;
            }
          }
          res.writeHead(proxyRes.statusCode ?? 502, responseHeaders);
          proxyRes.pipe(res, { end: true });
        }
      );

      proxyReq.on("error", (err) => {
        console.error("API proxy error:", err.message);
        if (!res.headersSent) {
          res.writeHead(502, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "API server unavailable" }));
        }
      });

      req.pipe(proxyReq, { end: true });
      return;
    }

    // Serve static files
    (async () => {
      const filePath = join(PUBLIC_DIR, urlPath);
      try {
        const s = await stat(filePath);
        if (s.isFile()) {
          const content = await readFile(filePath);
          const mime = MIME[extname(filePath)] ?? "application/octet-stream";
          res.writeHead(200, {
            "Content-Type": mime,
            "Cache-Control": urlPath.startsWith("/assets/")
              ? "public, max-age=31536000, immutable"
              : "no-cache",
          });
          res.end(content);
          return;
        }
      } catch {
        // file not found — fall through to SPA fallback
      }

      // SPA fallback: serve index.html
      const index = await readFile(join(PUBLIC_DIR, "index.html"));
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" });
      res.end(index);
    })().catch((err) => {
      console.error("Static serve error:", err.message);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Internal server error");
      }
    });
  } catch (err) {
    console.error("Request handler error:", err.message);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Internal server error");
    }
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Bakery frontend serving on port ${PORT}, proxying /api to localhost:${API_PORT}`);
});
