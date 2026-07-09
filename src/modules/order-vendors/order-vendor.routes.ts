import { Router } from "express";
import * as orderVendorController from "./order-vendor.controller";
import { validate } from "@/middlewares/validate.middleware";
import { authenticate } from "@/middlewares/auth.middleware";
import {
  selectVendorSchema,
  orderIdParamSchema,
  orderVendorCategoryParamSchema,
} from "./order-vendor.schema";

const orderVendorRoutes = Router();

// Seluruh ekosistem rute transaksi wajib melewati gerbang otentikasi
orderVendorRoutes.use(authenticate);

// ============================================================================
// ORDER VENDORS ROUTES (Base Path: /api/v1/order-vendors)
// ============================================================================

// ── 1. SUB-PATH DYNAMIC CONFIGURATIONS (DI ATAS) ────────────────────────────
/**
 * @swagger
 * /order-vendors/order/{orderId}/category/{category}:
 *   get:
 *     summary: Ambil satu detail vendor terpilih berdasarkan kategori step tertentu
 *     tags: [Order Vendors Core]
 */
orderVendorRoutes.get(
  "/order/:orderId/category/:category",
  validate(orderVendorCategoryParamSchema, "params"),
  orderVendorController.getVendorByCategory,
);

/**
 * @swagger
 * /order-vendors/order/{orderId}:
 *   get:
 *     summary: Ambil semua vendor yang sudah terkumpul di draf pesanan tertentu
 *     tags: [Order Vendors Core]
 */
orderVendorRoutes.get(
  "/order/:orderId",
  validate(orderIdParamSchema, "params"),
  orderVendorController.getVendorsByOrder,
);

// ── 2. MUTATION CONFIGURATIONS ──────────────────────────────────────────────
/**
 * @swagger
 * /order-vendors/select:
 *   post:
 *     summary: Simpan / perbarui pilihan vendor klien per step form (Step 1-5)
 *     tags: [Order Vendors Core]
 */
orderVendorRoutes.post(
  "/select",
  validate(selectVendorSchema, "body"),
  orderVendorController.selectVendor,
);

export default orderVendorRoutes;
