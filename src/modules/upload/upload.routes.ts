import { Router, Request } from "express";
import multer, { FileFilterCallback } from "multer";
import * as uploadController from "./upload.controller";
import { authenticate } from "@/middlewares/auth.middleware";
import { validate } from "@/middlewares/validate.middleware";
import { uploadQuerySchema } from "./upload.schema";
import { AppError } from "@/middlewares/error.middleware";

// ============================================================================
// 1. CONFIGURASI MULTER MANDIRI & NETRAL (Temuan 4)
// ============================================================================

const storage = multer.memoryStorage();

function genericFileFilter(
  req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
) {
  const allowedImages = ["image/jpeg", "image/png", "image/webp"];
  const allowedDocs = ["application/pdf"];

  // Ambil parameter folder dari query string murni untuk filter awal sebelum validasi Zod
  const folder = req.query.folder as string;

  if (folder === "avatars") {
    // Saringan Ekstensi Dinamis: Validasi agar avatar TIDAK boleh menerima PDF
    if (allowedImages.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new AppError("Avatar hanya boleh berupa gambar (JPG, PNG, WebP)", 400),
      );
    }
  } else {
    // Portfolios mengizinkan gambar dan dokumen pendukung/penawaran
    if ([...allowedImages, ...allowedDocs].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new AppError(
          "Format berkas portfolio tidak didukung. Gunakan JPG, PNG, WebP, atau PDF",
          400,
        ),
      );
    }
  }
}

// Menggunakan nama field multipart yang netral ("file" dan "files") bukan "proof" lagi
export const uploadSingleGeneric = multer({
  storage,
  fileFilter: genericFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // Batasan ketat 5MB untuk single file
}).single("file");

export const uploadMultipleGeneric = multer({
  storage,
  fileFilter: genericFileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // Batasan ketat 10MB per file
}).array("files", 10); // Batasan maksimal 10 file sekaligus

// ============================================================================
// 2. FINAL WIRING ROUTES (Base Path: /api/v1/upload)
// ============================================================================

const uploadRoutes = Router();

// Seluruh ekosistem upload wajib menyertakan token JWT untuk identifikasi userId & role
uploadRoutes.use(authenticate);

/**
 * @swagger
 * /upload/single:
 *   post:
 *     summary: Upload satu file secara generik (Maks 5MB - JPEG, PNG, WebP untuk avatar; PDF opsional untuk portfolio)
 *     tags: [Upload Utility]
 *     parameters:
 *       - in: query
 *         name: folder
 *         required: true
 *         schema:
 *           type: string
 *           enum: [avatars, portfolios]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 */
uploadRoutes.post(
  "/single",
  uploadSingleGeneric, // 1. Ekstrak file dari multipart form-data
  validate(uploadQuerySchema, "query"), // 2. Validasi parameter folder lewat Zod
  uploadController.uploadSingleFile, // 3. Teruskan ke controller & service
);

/**
 * @swagger
 * /upload/multiple:
 *   post:
 *     summary: Upload banyak file sekaligus untuk portfolio (Maks 10MB per file, maks 10 file)
 *     tags: [Upload Utility]
 *     parameters:
 *       - in: query
 *         name: folder
 *         required: true
 *         schema:
 *           type: string
 *           enum: [avatars, portfolios]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [files]
 *             properties:
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 */
uploadRoutes.post(
  "/multiple",
  uploadMultipleGeneric,
  validate(uploadQuerySchema, "query"),
  uploadController.uploadMultipleFiles,
);

export default uploadRoutes;
