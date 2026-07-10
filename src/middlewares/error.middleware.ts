import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { logger } from "../config/logger";

/**
 * Custom error class — dipakai di seluruh aplikasi
 * untuk throw error dengan status code yang tepat
 */
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public isOperational: boolean = true,
  ) {
    super(message);
    this.name = "AppError";
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Standard response shape untuk seluruh API
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  message = "Success",
  statusCode = 200,
) {
  return res.status(statusCode).json({ success: true, message, data });
}

export function sendError(res: Response, message: string, statusCode = 500) {
  return res.status(statusCode).json({ success: false, message, data: null });
}

/**
 * Global error handler — HARUS didaftarkan terakhir di app.ts
 * Menangani: AppError, ZodError, Prisma errors, dan error tak terduga lainnya
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // 1. Zod validation errors (dari validate middleware)
  if (err instanceof ZodError) {
    const messages = err.issues.map((e) => `${e.path.join(".")}: ${e.message}`);
    res.status(400).json({
      success: false,
      message: "Validasi gagal",
      errors: messages,
      data: null,
    });
    return;
  }

  // 2. Custom AppError
  if (err instanceof AppError) {
    if (!err.isOperational) {
      logger.error(err, "Non-operational AppError");
    }
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      data: null,
    });
    return;
  }

  // 3. Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // P2002: Unique constraint violation
    if (err.code === "P2002") {
      const fields = (err.meta?.target as string[])?.join(", ") ?? "field";
      res.status(409).json({
        success: false,
        message: `Data dengan ${fields} tersebut sudah terdaftar`,
        data: null,
      });
      return;
    }

    // P2025: Record not found
    if (err.code === "P2025") {
      res.status(404).json({
        success: false,
        message: "Data tidak ditemukan",
        data: null,
      });
      return;
    }

    // P2034: Serialization conflict / deadlock pada transaksi Serializable
    // (mis. dua client rebutan tanggal vendor yang sama secara bersamaan).
    // Seharusnya sudah ditangani oleh withSerializableRetry() di service layer;
    // kalau tetap sampai sini artinya retry-nya sudah habis dan konfliknya
    // masih terjadi terus-menerus. Jangan diperlakukan sebagai bug 500 —
    // ini kondisi yang wajar terjadi di traffic tinggi, cukup minta user coba lagi.
    if (err.code === "P2034") {
      logger.warn(err, "Transaksi Serializable gagal setelah retry habis");
      res.status(409).json({
        success: false,
        message:
          "Terjadi permintaan bersamaan pada data yang sama. Silakan coba lagi.",
        data: null,
      });
      return;
    }
  }

  // 4. Error tak terduga — log full stack, jangan expose detail ke client
  logger.error(err, "Unexpected error");
  res.status(500).json({
    success: false,
    message: "Terjadi kesalahan pada server. Silakan coba lagi.",
    data: null,
  });
}
