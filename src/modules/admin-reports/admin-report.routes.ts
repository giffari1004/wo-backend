import { Router } from "express";
import * as adminReportController from "./admin-report.controller";
import { validate } from "../../middlewares/validate.middleware";
import { authenticate, authorize } from "../../middlewares/auth.middleware";
import {
  revenueReportQuerySchema,
  vendorPerformanceQuerySchema,
} from "./admin-report.schema";
import { UserRole } from "@prisma/client";

const adminReportRoutes = Router();

adminReportRoutes.use(authenticate, authorize(UserRole.ADMIN));

// ============================================================================
// ADMIN REPORT ROUTES (Base Path: /api/v1/admin/reports)
// ============================================================================
//
// Export Excel BELUM ada (butuh dependency baru, exceljs) — baru JSON +
// PDF export yang tersedia sekarang.

adminReportRoutes.get(
  "/revenue",
  validate(revenueReportQuerySchema, "query"),
  adminReportController.getRevenueReport,
);

adminReportRoutes.get(
  "/revenue/export/pdf",
  validate(revenueReportQuerySchema, "query"),
  adminReportController.exportRevenueReportPdf,
);

adminReportRoutes.get(
  "/vendor-performance",
  validate(vendorPerformanceQuerySchema, "query"),
  adminReportController.getVendorPerformanceReport,
);

adminReportRoutes.get(
  "/vendor-performance/export/pdf",
  validate(vendorPerformanceQuerySchema, "query"),
  adminReportController.exportVendorPerformancePdf,
);

export default adminReportRoutes;
