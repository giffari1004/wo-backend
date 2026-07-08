import { Router } from "express";
import * as packageController from "./package.controller";
import {
  createPackageSchema,
  updatePackageSchema,
  packageIdParamSchema,
} from "./package.schema";
import { validate } from "@/middlewares/validate.middleware";
import { authenticate, authorize } from "@/middlewares/auth.middleware";

// ============================================================================
// PACKAGE ROUTES
// Base path: /api/v1/packages
// ============================================================================

const packageRoutes = Router();

// ── 1. Public List Endpoint ──────────────────────────────────────────────────
/**
 * @swagger
 * /packages:
 *   get:
 *     summary: Ambil daftar paket yang aktif (Landing Page / Client Side)
 *     tags: [Packages]
 *     security: []
 *     responses:
 *       200:
 *         description: Berhasil mengambil daftar paket aktif
 */
packageRoutes.get("/", packageController.getPublicPackages);

// ── 2. Admin Specific Endpoint (URUTAN DI ATAS WILDCARD :id) ──────────────────
/**
 * @swagger
 * /packages/admin/all:
 *   get:
 *     summary: Ambil semua data paket terdaftar (Termasuk yang non-aktif — Admin Only)
 *     tags: [Packages Master Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Berhasil mengambil semua daftar paket untuk admin
 */
packageRoutes.get(
  "/admin/all",
  authenticate,
  authorize("ADMIN"),
  packageController.getAllPackagesForAdmin,
);

// ── 3. Wildcard / Dynamic Params Endpoints (URUTAN DI BAWAH) ──────────────────
/**
 * @swagger
 * /packages/{id}:
 *   get:
 *     summary: Ambil detail satu paket berdasarkan ID
 *     tags: [Packages]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Berhasil mengambil detail paket
 *       404:
 *         description: Paket tidak ditemukan
 */
packageRoutes.get(
  "/:id",
  validate(packageIdParamSchema, "params"),
  packageController.getPackageById,
);

/**
 * @swagger
 * /packages:
 *   post:
 *     summary: Buat master data paket baru (Admin Only)
 *     tags: [Packages Master Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tier, name, basePrice, guestCapacity]
 *             properties:
 *               tier:
 *                 type: string
 *                 enum: [SILVER, GOLD, PLATINUM]
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               basePrice:
 *                 type: number
 *               guestCapacity:
 *                 type: number
 *     responses:
 *       201:
 *         description: Paket baru berhasil dibuat
 *       409:
 *         description: Tier paket sudah terdaftar
 */
packageRoutes.post(
  "/",
  authenticate,
  authorize("ADMIN"),
  validate(createPackageSchema),
  packageController.createPackage,
);

/**
 * @swagger
 * /packages/{id}:
 *   patch:
 *     summary: Perbarui data master paket secara parsial (Admin Only)
 *     tags: [Packages Master Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Paket berhasil diperbarui
 */
packageRoutes.patch(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  validate(packageIdParamSchema, "params"),
  validate(updatePackageSchema),
  packageController.updatePackage,
);

/**
 * @swagger
 * /packages/{id}:
 *   delete:
 *     summary: Hapus paket secara aman / soft delete (Admin Only)
 *     tags: [Packages Master Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Paket berhasil dihapus
 */
packageRoutes.delete(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  validate(packageIdParamSchema, "params"),
  packageController.deletePackage,
);

export default packageRoutes;
