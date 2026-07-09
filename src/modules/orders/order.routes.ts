import { Router } from "express";
import * as orderController from "./order.controller";
import { validate } from "@/middlewares/validate.middleware";
import { authenticate, authorize } from "@/middlewares/auth.middleware";
import {
  createOrderDraftSchema,
  updateOrderDraftSchema,
  orderIdParamSchema,
  getOrdersQuerySchema,
} from "./order.schema";

const orderRoutes = Router();

orderRoutes.use(authenticate);

// ── 1. ROUTE STATIS MASTER (WAJIB PALING ATAS UNTUK CEGAH SHADOWING WILDCARD :id) ──

orderRoutes.get(
  "/admin/all",
  authorize("ADMIN"),
  validate(getOrdersQuerySchema, "query"),
  orderController.getAllOrdersForAdmin,
);

orderRoutes.get("/my-orders", orderController.getClientOrders);

// ── 2. CORE RESOURCE ACTION CREATION ───────────────────────────────────────────────

orderRoutes.post(
  "/",
  validate(createOrderDraftSchema),
  orderController.createOrderDraft,
);

// ── 3. DYNAMIC WILDCARD PARAMETERS PATHS (DI BAWAH) ────────────────────────────────

orderRoutes.get(
  "/:id",
  validate(orderIdParamSchema, "params"),
  orderController.getOrderById,
);

orderRoutes.patch(
  "/:id/draft",
  validate(orderIdParamSchema, "params"),
  validate(updateOrderDraftSchema),
  orderController.updateOrderDraft,
);

orderRoutes.post(
  "/:id/submit",
  validate(orderIdParamSchema, "params"),
  orderController.submitOrder,
);

orderRoutes.post(
  "/:id/cancel",
  validate(orderIdParamSchema, "params"),
  orderController.cancelOrder,
);

export default orderRoutes;
