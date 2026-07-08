import { Request, Response, NextFunction } from "express";
import * as packageService from "./package.service";
import { sendSuccess } from "@/middlewares/error.middleware";

// ============================================================================
// PACKAGE CONTROLLER
// ============================================================================

// Tipe params untuk route yang menggunakan /:id
// Dipakai sebagai generic di Request<IdParams> supaya TypeScript tahu
// bahwa req.params.id selalu bertipe string, bukan string | undefined
type IdParams = { id: string };

export async function getPublicPackages(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await packageService.getPublicPackages();
    sendSuccess(res, result, "Daftar paket aktif berhasil diambil");
  } catch (err) {
    next(err);
  }
}

export async function getAllPackagesForAdmin(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await packageService.getAllPackagesForAdmin();
    sendSuccess(res, result, "Seluruh daftar paket admin berhasil diambil");
  } catch (err) {
    next(err);
  }
}

export async function getPackageById(
  req: Request<IdParams>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // req.params.id sudah dijamin ada dan berupa string melalui validasi Zod params di router
    const result = await packageService.getPackageById(req.params.id);
    sendSuccess(res, result, "Detail paket berhasil diambil");
  } catch (err) {
    next(err);
  }
}

export async function createPackage(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await packageService.createPackage(req.body);
    sendSuccess(res, result, "Paket baru berhasil dibuat", 201);
  } catch (err) {
    next(err);
  }
}

export async function updatePackage(
  req: Request<IdParams>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await packageService.updatePackage(req.params.id, req.body);
    sendSuccess(res, result, "Data paket berhasil diperbarui");
  } catch (err) {
    next(err);
  }
}

export async function deletePackage(
  req: Request<IdParams>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await packageService.deletePackage(req.params.id);
    sendSuccess(res, null, "Paket berhasil dihapus");
  } catch (err) {
    next(err);
  }
}
