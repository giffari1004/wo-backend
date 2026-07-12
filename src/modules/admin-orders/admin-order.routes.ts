import { Router } from "express";
import * as adminOrderController from "./admin-order.controller";
import { validate } from "../../middlewares/validate.middleware";
import { authenticate, authorize } from "../../middlewares/auth.middleware";
import {
  orderIdParamSchema,
  listOrdersQuerySchema,
  cancelOrderSchema,
} from "./admin-order.schema";
import { UserRole } from "@prisma/client";

const adminOrderRoutes = Router();

// Seluruh modul admin/* murni admin-only
adminOrderRoutes.use(authenticate, authorize(UserRole.ADMIN));

// ============================================================================
// ADMIN ORDER ROUTES (Base Path: /api/v1/admin/orders)
// ============================================================================
//
// Update checklist preparation TIDAK ada di sini — sudah ditangani modul
// preparation (PATCH /api/v1/preparation/:taskId), admin-only juga.

adminOrderRoutes.get(
  "/",
  validate(listOrdersQuerySchema, "query"),
  adminOrderController.listOrders,
);

adminOrderRoutes.get(
  "/:orderId",
  validate(orderIdParamSchema, "params"),
  adminOrderController.getOrderDetail,
);

adminOrderRoutes.patch(
  "/:orderId/cancel",
  validate(orderIdParamSchema, "params"),
  validate(cancelOrderSchema, "body"),
  adminOrderController.cancelOrder,
);

export default adminOrderRoutes;
