import { Router } from "express";
import * as invoiceController from "./invoice.controller";
import { validate } from "../../middlewares/validate.middleware";
import { authenticate, authorize } from "../../middlewares/auth.middleware";
import {
  invoiceIdParamSchema,
  orderIdParamSchema,
  paymentIdParamSchema,
} from "./invoice.schema";
import { UserRole } from "@prisma/client";

const invoiceRoutes = Router();

// Seluruh akses terhadap dokumen finansial sensitif dilindungi auth token[cite: 4, 9]
invoiceRoutes.use(authenticate);

// ============================================================================
// INVOICE ECOSYSTEM ROUTES (Base Path: /api/v1/invoices)
// ============================================================================

invoiceRoutes.get(
  "/order/:orderId",
  validate(orderIdParamSchema, "params"),
  invoiceController.getInvoicesByOrder,
);

// 🆕 Jaring pengaman manual (admin-only): generate ulang invoice yang gagal
// dibuat otomatis saat payment.verifyPayment. Idempotent — aman dipanggil
// berkali-kali untuk paymentId yang sama.
invoiceRoutes.post(
  "/:paymentId/regenerate",
  authorize(UserRole.ADMIN),
  validate(paymentIdParamSchema, "params"),
  invoiceController.regenerateInvoice,
);

invoiceRoutes.get(
  "/:invoiceNumber",
  validate(invoiceIdParamSchema, "params"),
  invoiceController.getInvoiceDetail,
);

export default invoiceRoutes;
