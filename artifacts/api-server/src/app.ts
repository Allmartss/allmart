import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import path from "path";
import { fileURLToPath } from "url";
import router from "./routes";
import { logger } from "./lib/logger";
import { sessionMiddleware } from "./lib/session";
import { ensureUploadsDir } from "./lib/localStorageFallback";
import { isAllowedRequestOrigin, trustedOrigins } from "./lib/trusted-origin";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATIC_DIR = path.resolve(__dirname, "../../storefront/dist/public");
// Storefront source public dir — served in dev AND in prod (Vite copies it into dist on build)
const STOREFRONT_PUBLIC = path.resolve(__dirname, "../../storefront/public");

// Ensure local uploads directory exists at startup (no FILE_* keys needed)
ensureUploadsDir();

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
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || isAllowedRequestOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin is not allowed"));
    },
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(sessionMiddleware);

app.use("/api", router);

// Serve storefront public assets (logo.svg, vmc.pem, etc.) directly from source
// so they're reachable at the root domain in both dev and production
app.use(express.static(STOREFRONT_PUBLIC));
app.use(express.static(STATIC_DIR));
app.get("/{*path}", (_req, res) => {
  res.sendFile(path.join(STATIC_DIR, "index.html"));
});

app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error({ err, path: req.path }, "Unhandled request error");
  if (res.headersSent) {
    next(err);
    return;
  }
  res.status(500).json({ error: "Internal error" });
});

export default app;
