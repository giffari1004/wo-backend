import { Request, Response, NextFunction } from "express";
import * as authService from "./auth.service";
import { sendSuccess } from "@/middlewares/error.middleware";
// import { sendSuccess } from "../middlewares/error.middleware";

// ============================================================================
// AUTH CONTROLLER
// Controller hanya bertanggung jawab untuk:
// 1. Memanggil service dengan input yang sudah divalidasi Zod
// 2. Mengembalikan response dengan format yang konsisten
// 3. Meneruskan error ke global error handler via next(err)
//
// Semua business logic ada di auth.service.ts — jangan taruh logic di sini
// ============================================================================

export async function register(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // req.body sudah divalidasi oleh validate middleware sebelum sampai di sini
    const result = await authService.register(req.body);

    sendSuccess(res, result, "Registrasi berhasil", 201);
  } catch (err) {
    next(err);
  }
}

export async function login(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await authService.login(req.body);

    sendSuccess(res, result, "Login berhasil");
  } catch (err) {
    next(err);
  }
}

export async function getMe(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // req.user di-set oleh authenticate middleware sebelum sampai di sini
    const user = await authService.getMe(req.user!.id);

    sendSuccess(res, { user }, "Data profile berhasil diambil");
  } catch (err) {
    next(err);
  }
}

export async function forgotPassword(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await authService.forgotPassword(req.body);

    // Response selalu sama terlepas dari apakah email terdaftar atau tidak
    // untuk mencegah user enumeration attack
    sendSuccess(
      res,
      null,
      "Jika email terdaftar, link reset password akan dikirim ke inbox Anda",
    );
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await authService.resetPassword(req.body);

    sendSuccess(res, null, "Password berhasil direset. Silakan login kembali");
  } catch (err) {
    next(err);
  }
}

export async function changePassword(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await authService.changePassword(req.user!.id, req.body);

    sendSuccess(res, null, "Password berhasil diubah");
  } catch (err) {
    next(err);
  }
}

export async function deleteAccount(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await authService.deleteAccount(req.user!.id);

    sendSuccess(res, null, "Akun berhasil dihapus");
  } catch (err) {
    next(err);
  }
}
