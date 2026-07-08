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

const router = Router();

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
router.get(
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
router.get(
  "/vendor/:vendorId",
  validate(vendorIdParamSchema, "params"),
  cateringMenuController.getMenusByVendor,
);

// ── 2. GLOBAL SYSTEM CORE ENDPOINTS ─────────────────────────────────────────

router.post(
  "/",
  authenticate,
  authorize("ADMIN"),
  validate(createCateringMenuSchema),
  cateringMenuController.createCateringMenu,
);

// ── 3. DYNAMIC WILDCARD PARAMETERS (DI BAWAH) ───────────────────────────────

router.get(
  "/:id",
  validate(cateringMenuIdParamSchema, "params"),
  cateringMenuController.getMenuById,
);

router.patch(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  validate(cateringMenuIdParamSchema, "params"),
  validate(updateCateringMenuSchema),
  cateringMenuController.updateCateringMenu,
);

router.delete(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  validate(cateringMenuIdParamSchema, "params"),
  cateringMenuController.deleteCateringMenu,
);

export default router;
