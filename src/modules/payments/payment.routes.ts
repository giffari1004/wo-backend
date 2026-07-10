import { Router } from "express";
import * as paymentController from "./payment.controller";
import { validate } from "../../middlewares/validate.middleware";
import { authenticate, authorize } from "../../middlewares/auth.middleware";
import { uploadPaymentProof } from "../../middlewares/upload.middleware";
import {
  paymentIdParamSchema,
  orderIdParamSchema,
  uploadProofSchema,
  verifyPaymentSchema,
} from "./payment.schema";
import { UserRole } from "@prisma/client";

const paymentRoutes = Router();

paymentRoutes.use(authenticate);

// ============================================================================
// PAYMENT MODULE ROUTES (Base Path: /api/v1/payments)
// ============================================================================

// 🔴 SOLUSI BUG #4: Pendaftaran Rute Ekstra GET untuk Dashboard Klien & Antrean Verifikasi Admin[cite: 2, 7]
paymentRoutes.get(
  "/order/:orderId",
  validate(orderIdParamSchema, "params"),
  paymentController.getPaymentsByOrder,
);

paymentRoutes.get(
  "/admin/queue",
  authorize(UserRole.ADMIN),
  paymentController.getAdminVerificationQueue,
);

paymentRoutes.post(
  "/:paymentId/proof",
  uploadPaymentProof,
  validate(paymentIdParamSchema, "params"),
  validate(uploadProofSchema, "body"),
  paymentController.uploadProof,
);

paymentRoutes.post(
  "/:paymentId/verify",
  authorize(UserRole.ADMIN),
  validate(paymentIdParamSchema, "params"),
  validate(verifyPaymentSchema, "body"),
  paymentController.verifyPayment,
);

export default paymentRoutes;
