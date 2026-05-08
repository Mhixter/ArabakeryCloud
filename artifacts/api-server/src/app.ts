import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { resolve } from "path";
import { existsSync } from "fs";
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
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// 404 handler for unmatched /api routes (must come before static serving)
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Serve static frontend files in production when STATIC_DIR is set
const staticDir = process.env.STATIC_DIR;
if (staticDir) {
  const absStaticDir = resolve(staticDir);
  app.use(express.static(absStaticDir));
  // SPA fallback — serve index.html for all non-API client-side routes
  app.get("*", (_req, res) => {
    const indexPath = resolve(absStaticDir, "index.html");
    if (existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(503).json({ error: "Frontend not built" });
    }
  });
}

export default app;
