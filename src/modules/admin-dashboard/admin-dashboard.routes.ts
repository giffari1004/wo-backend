import { Router } from "express";
import * as adminDashboardController from "./admin-dashboard.controller";
import { validate } from "../../middlewares/validate.middleware";
import { authenticate, authorize } from "../../middlewares/auth.middleware";
import { dashboardQuerySchema } from "./admin-dashboard.schema";
import { UserRole } from "@prisma/client";

const adminDashboardRoutes = Router();

// Seluruh modul admin/* wajib login DAN berrole ADMIN — dua-duanya
// diterapkan sekaligus di level router, tidak per-route seperti modul lain
// yang campur client/admin (di sini murni admin-only semua).
adminDashboardRoutes.use(authenticate, authorize(UserRole.ADMIN));

// ============================================================================
// ADMIN DASHBOARD ROUTES (Base Path: /api/v1/admin/dashboard)
// ============================================================================

adminDashboardRoutes.get(
  "/overview",
  validate(dashboardQuerySchema, "query"),
  adminDashboardController.getOverview,
);

export default adminDashboardRoutes;
