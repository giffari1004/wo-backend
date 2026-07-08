import express, { Application } from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env";
import { rateLimiter } from "./middlewares/rateLimit.middleware";
import { corsOptions } from "./config/cors";
import { errorHandler } from "./middlewares/error.middleware";
import { requestLogger } from "./config/logger";
import swaggerUi from "swagger-ui-express"
import { swaggerSpec } from "./config/swagger";
import authRoutes from "./modules/auth/auth.routes";
import packageRoutes from "./modules/packages/package.routes";


// Route imports (ditambahkan satu per satu sesuai module yang dibuat)

export function createApp(): Application {
  const app = express();

  // ── Security headers ──────────────────────────────
  app.use(helmet());

  // ── CORS ─────────────────────────────────────────
  app.use(cors(corsOptions));

  // ── Body parsers ──────────────────────────────────
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // ── Request logging ───────────────────────────────
  app.use(requestLogger);

  // ── Rate limiting (global) ────────────────────────
  app.use(rateLimiter);

  // ── Swagger
  // ──────────────────────────────────
  app.use(
    `${env.apiPrefix}/docs`,
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customSiteTitle: "WO Platform API Docs",
      swaggerOptions: { persistAuthorization: true },
    }),
  );

  app.get(`${env.apiPrefix}/docs/spec.json`, (_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
  });

  // ── Health check ──────────────────────────────────
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", env: env.nodeEnv });
  });

  // ── Routes ────────────────────────────────────────
  app.use(`${env.apiPrefix}/auth`, authRoutes);
  app.use(`${env.apiPrefix}/packages`, packageRoutes);
  // ... tambahkan route lain di sini

  // ── Global error handler (HARUS di paling akhir) ──
  app.use(errorHandler);

  return app;
}
