import express, { type Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
const allowedOrigins = (process.env.CORS_ORIGIN ?? "")
  .split(",")
  .map(o => o.trim())
  .filter(Boolean);
const deploymentOrigin = process.env.RENDER_EXTERNAL_URL?.replace(/\/+$/, "");

const corsMiddleware = cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
});

/*
 * The production SPA and API are served from the same Render host. Browsers
 * still send an Origin header for some same-origin POSTs, so do not route a
 * request back through the cross-origin allowlist when its origin matches the
 * request host. Cross-origin clients remain restricted to CORS_ORIGIN.
 */
app.use((req, res, next) => {
  const origin = req.get("origin");
  if (origin) {
    try {
      const originUrl = new URL(origin);
      const forwardedHost = req.get("x-forwarded-host")?.split(",")[0]?.trim();
      const requestHosts = [req.get("host"), forwardedHost].filter(Boolean);
      if (
        origin === deploymentOrigin ||
        requestHosts.some(host => originUrl.host === host)
      ) {
        return next();
      }
    } catch {
      // Let the CORS middleware return the normal origin error below.
    }
  }
  return corsMiddleware(req, res, next);
});
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api", router);

/* ── In production serve the built React SPA ── */
if (process.env.NODE_ENV === "production") {
  const staticDir = path.resolve(process.cwd(), "artifacts/bakery/dist/public");
  app.use(express.static(staticDir, {
    setHeaders: (res, filePath) => {
      const normalized = filePath.replace(/\\/g, "/");
      if (
        normalized.endsWith("index.html") ||
        normalized.endsWith("sw.js") ||
        normalized.endsWith("registerSW.js") ||
        normalized.endsWith(".webmanifest")
      ) {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
      } else if (normalized.includes("/assets/")) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      }
    },
  }));
  app.get(/.*/, (_req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.sendFile(path.join(staticDir, "index.html"));
  });
} else {
  app.get("/", (_req, res) => {
    res.json({ status: "ok", service: "Ara Bakery Cloud API", version: "1.0.0" });
  });
}

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err?.status ?? err?.statusCode ?? 500;
  const message = err?.message ?? "Internal server error";
  logger.error({ err }, message);
  res.status(status).json({ error: message });
});

export default app;
