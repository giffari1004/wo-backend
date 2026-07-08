import { Router } from "express";
import * as authController from "./auth.controller";
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from "./auth.schema";
import { validate } from "@/middlewares/validate.middleware";
import { authenticate } from "@/middlewares/auth.middleware";
import { authRateLimiter } from "@/middlewares/rateLimit.middleware";

// ============================================================================
// AUTH ROUTES
// Base path: /api/v1/auth (didaftarkan di app.ts)
//
// Public routes (tidak perlu token):
//   POST   /api/v1/auth/register
//   POST   /api/v1/auth/login
//   POST   /api/v1/auth/forgot-password
//   POST   /api/v1/auth/reset-password
//
// Protected routes (perlu token — pakai middleware authenticate):
//   GET    /api/v1/auth/me
//   PATCH  /api/v1/auth/change-password
//   DELETE /api/v1/auth/delete-account
// ============================================================================

const authRoutes = Router();

// ── Public routes ─────────────────────────────────────────────────────────────

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Registrasi akun client baru
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, phone, password, confirmPassword]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Budi Santoso
 *               email:
 *                 type: string
 *                 format: email
 *                 example: budi@example.com
 *               phone:
 *                 type: string
 *                 example: "081234567890"
 *               password:
 *                 type: string
 *                 example: Password123
 *               confirmPassword:
 *                 type: string
 *                 example: Password123
 *     responses:
 *       201:
 *         description: Registrasi berhasil, mengembalikan data user dan JWT token
 *       400:
 *         description: Validasi gagal
 *       409:
 *         description: Email atau nomor HP sudah terdaftar
 */
authRoutes.post(
  "/register",
  authRateLimiter,
  validate(registerSchema),
  authController.register,
);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login client atau admin
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login berhasil, mengembalikan data user dan JWT token
 *       401:
 *         description: Email atau password salah
 */
authRoutes.post(
  "/login",
  authRateLimiter,
  validate(loginSchema),
  authController.login,
);

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Request link reset password via email
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Response selalu sama terlepas email terdaftar atau tidak
 */
authRoutes.post(
  "/forgot-password",
  authRateLimiter,
  validate(forgotPasswordSchema),
  authController.forgotPassword,
);

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Reset password menggunakan token dari email
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, password, confirmPassword]
 *             properties:
 *               token:
 *                 type: string
 *               password:
 *                 type: string
 *               confirmPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password berhasil direset
 *       400:
 *         description: Token tidak valid atau sudah expired
 */
authRoutes.post(
  "/reset-password",
  validate(resetPasswordSchema),
  authController.resetPassword,
);

// ── Protected routes (butuh JWT token) ───────────────────────────────────────

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Ambil data profile user yang sedang login
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Data profile user
 *       401:
 *         description: Token tidak ditemukan atau tidak valid
 */
authRoutes.get("/me", authenticate, authController.getMe);

/**
 * @swagger
 * /auth/change-password:
 *   patch:
 *     summary: Ubah password user yang sedang login
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword, confirmNewPassword]
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *               confirmNewPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password berhasil diubah
 *       400:
 *         description: Password saat ini tidak sesuai
 */
authRoutes.patch(
  "/change-password",
  authenticate,
  validate(changePasswordSchema),
  authController.changePassword,
);

/**
 * @swagger
 * /auth/delete-account:
 *   delete:
 *     summary: Hapus akun user yang sedang login (soft delete)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Akun berhasil dihapus
 */
authRoutes.delete("/delete-account", authenticate, authController.deleteAccount);

export default authRoutes;
