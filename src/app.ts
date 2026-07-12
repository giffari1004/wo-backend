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
import vendorRoutes from "./modules/vendors/vendor.routes";
import cateringMenuRoutes from "./modules/catering-menu/catering-menu.routes";
import orderRoutes from "./modules/orders/order.routes";
import orderVendorRoutes from "./modules/order-vendors/order-vendor.routes";
import paymentRoutes from "./modules/payments/payment.routes";
import invoiceRoutes from "./modules/invoices/invoice.routes";
import preparationRoutes from "./modules/preparations/preparation.routes";
import rsvpRoutes from "./modules/rsvp/rsvp.routes";
import clientRequestRoutes from "./modules/client-request/client-request.routes";
import rescheduleRequestRoutes from "./modules/reschedule-request/reschedule-request.routes";
import notificationRoutes from "./modules/notifications/notification.routes";
import adminDashboardRoutes from "./modules/admin-dashboard/admin-dashboard.routes";
import adminOrderRoutes from "./modules/admin-orders/admin-order.routes";
import adminPaymentRoutes from "./modules/admin-payments/admin-payment.routes";
import adminCalendarRoutes from "./modules/admin-calendar/admin-calendar.routes";


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

  // ── Health check ──────────────────────────────────
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", env: env.nodeEnv });
  });

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

  // ── Routes ────────────────────────────────────────
  app.use(`${env.apiPrefix}/auth`, authRoutes);
  app.use(`${env.apiPrefix}/packages`, packageRoutes);
  app.use(`${env.apiPrefix}/vendors`, vendorRoutes);
  app.use(`${env.apiPrefix}/catering-menu`, cateringMenuRoutes);
  app.use(`${env.apiPrefix}/orders`, orderRoutes);
  app.use(`${env.apiPrefix}/order-vendors`, orderVendorRoutes);
  app.use(`${env.apiPrefix}/payments`, paymentRoutes);
  app.use(`${env.apiPrefix}/invoices`, invoiceRoutes);
  app.use(`${env.apiPrefix}/preparation`, preparationRoutes);
  app.use(`${env.apiPrefix}/rsvp`, rsvpRoutes);
  app.use(`${env.apiPrefix}/client-request`, clientRequestRoutes);
  app.use(`${env.apiPrefix}/reschedule-request`, rescheduleRequestRoutes);
  app.use(`${env.apiPrefix}/notification`, notificationRoutes);
  app.use(`${env.apiPrefix}/admin/dashboard`, adminDashboardRoutes);
  app.use(`${env.apiPrefix}/admin/orders`, adminOrderRoutes);
  app.use(`${env.apiPrefix}/admin/payments`, adminPaymentRoutes);
  app.use(`${env.apiPrefix}/admin/calendar`, adminCalendarRoutes);
  // ... tambahkan route lain di sini

  // ── Global error handler (HARUS di paling akhir) ──
  app.use(errorHandler);

  return app;
}
