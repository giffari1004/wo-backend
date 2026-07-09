import { Router } from "express";
import * as cateringMenuController from "./catering-menu.controller";
import { validate } from "@/middlewares/validate.middleware";
import { authenticate, authorize } from "@/middlewares/auth.middleware";
import {
  createCateringMenuSchema,
  updateCateringMenuSchema,
  cateringMenuIdParamSchema,
  vendorIdParamSchema,
} from "./catering-menu.schema";

const cateringMenuRoutes = Router();

// ============================================================================
// CATERING MENU ROUTES
// Base Path: /api/v1/catering-menus
// ============================================================================

// ── 1. ROUTE STATIS ADMIN & SUB-RESOURCE (WAJIB DI ATAS WILDCARD) ────────────

/**
 * @swagger
 * /catering-menus/admin/all:
 *   get:
 *     summary: Ambil seluruh menu katering lintas vendor tanpa filter status (Admin Only)
 *     tags: [Catering Menus Master Admin]
 *     security:
 *       - bearerAuth: []
 */
cateringMenuRoutes.get(
  "/admin/all",
  authenticate,
  authorize("ADMIN"),
  cateringMenuController.getAllMenusForAdmin,
);

/**
 * @swagger
 * /catering-menus/vendor/{vendorId}:
 *   get:
 *     summary: Ambil daftar semua menu katering aktif milik vendor aktif tertentu (Client Side)
 *     tags: [Catering Menus]
 *     security: []
 */
cateringMenuRoutes.get(
  "/vendor/:vendorId",
  validate(vendorIdParamSchema, "params"),
  cateringMenuController.getMenusByVendor,
);

// ── 2. GLOBAL SYSTEM CORE ENDPOINTS ─────────────────────────────────────────

cateringMenuRoutes.post(
  "/",
  authenticate,
  authorize("ADMIN"),
  validate(createCateringMenuSchema),
  cateringMenuController.createCateringMenu,
);

// ── 3. DYNAMIC WILDCARD PARAMETERS (DI BAWAH) ───────────────────────────────

cateringMenuRoutes.get(
  "/:id",
  validate(cateringMenuIdParamSchema, "params"),
  cateringMenuController.getMenuById,
);

cateringMenuRoutes.patch(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  validate(cateringMenuIdParamSchema, "params"),
  validate(updateCateringMenuSchema),
  cateringMenuController.updateCateringMenu,
);

cateringMenuRoutes.delete(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  validate(cateringMenuIdParamSchema, "params"),
  cateringMenuController.deleteCateringMenu,
);

export default cateringMenuRoutes;
