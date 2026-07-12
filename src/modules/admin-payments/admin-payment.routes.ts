import { Router } from "express";
import * as adminPaymentController from "./admin-payment.controller";
import { validate } from "../../middlewares/validate.middleware";
import { authenticate, authorize } from "../../middlewares/auth.middleware";
import {
  paymentIdParamSchema,
  listPaymentsQuerySchema,
} from "./admin-payment.schema";
import { UserRole } from "@prisma/client";

const adminPaymentRoutes = Router();

adminPaymentRoutes.use(authenticate, authorize(UserRole.ADMIN));

// ============================================================================
// ADMIN PAYMENT ROUTES (Base Path: /api/v1/admin/payments)
// ============================================================================
//
// Approve/reject pembayaran TIDAK ada di sini — sudah ditangani modul
// payments (POST /api/v1/payments/:paymentId/verify). Modul ini murni
// read-only: ledger/riwayat penuh + detail dengan info audit.

adminPaymentRoutes.get(
  "/",
  validate(listPaymentsQuerySchema, "query"),
  adminPaymentController.listPayments,
);

adminPaymentRoutes.get(
  "/:paymentId",
  validate(paymentIdParamSchema, "params"),
  adminPaymentController.getPaymentDetail,
);

export default adminPaymentRoutes;
