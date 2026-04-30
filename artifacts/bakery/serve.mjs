import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const PUBLIC_DIR = join(__dirname, "dist/public");
const PORT = parseInt(process.env["PORT"] ?? "3000", 10);

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

const server = createServer(async (req, res) => {
  try {
    const urlPath = (req.url ?? "/").split("?")[0];
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
  } catch (err) {
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Internal server error");
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Bakery frontend serving on port ${PORT}`);
});
