import { Request, Response, NextFunction } from "express";
import * as vendorService from "./vendor.service";
import { sendSuccess } from "@/middlewares/error.middleware";
import { VendorCategory } from "@prisma/client";

type IdParams = {
  id: string;
  portfolioId: string;
};

export async function getPublicVendors(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // req.query sudah melewati saringan Zod resmi dari route validator
    const { category } = req.query as { category?: VendorCategory };
    const result = await vendorService.getPublicVendors(category);
    sendSuccess(res, result, "Daftar vendor aktif berhasil diambil");
  } catch (err) {
    next(err);
  }
}

export async function getAllVendorsForAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { category } = req.query as { category?: VendorCategory };
    const result = await vendorService.getAllVendorsForAdmin(category);
    sendSuccess(
      res,
      result,
      "Seluruh master data vendor admin berhasil diambil",
    );
  } catch (err) {
    next(err);
  }
}

export async function getVendorById(
  req: Request<IdParams>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await vendorService.getVendorById(req.params.id);
    sendSuccess(res, result, "Detail data vendor berhasil diambil");
  } catch (err) {
    next(err);
  }
}

export async function createVendor(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await vendorService.createVendor(req.body);
    sendSuccess(res, result, "Vendor baru berhasil didaftarkan", 201);
  } catch (err) {
    next(err);
  }
}

export async function updateVendor(
  req: Request<IdParams>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await vendorService.updateVendor(req.params.id, req.body);
    sendSuccess(res, result, "Master data vendor berhasil diperbarui");
  } catch (err) {
    next(err);
  }
}

export async function deleteVendor(
  req: Request<IdParams>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await vendorService.deleteVendor(req.params.id);
    sendSuccess(res, null, "Data master vendor berhasil dihapus");
  } catch (err) {
    next(err);
  }
}

export async function addVendorPortfolio(
  req: Request<IdParams>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await vendorService.addVendorPortfolio(
      req.params.id,
      req.body,
    );
    sendSuccess(res, result, "Item media portfolio berhasil ditambahkan", 201);
  } catch (err) {
    next(err);
  }
}

export async function deleteVendorPortfolio(
  req: Request<IdParams>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await vendorService.deleteVendorPortfolio(req.params.portfolioId);
    sendSuccess(res, null, "Item portfolio berhasil dihapus secara permanen");
  } catch (err) {
    next(err);
  }
}

export async function setVendorAvailability(
  req: Request<IdParams>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await vendorService.setVendorAvailability(
      req.params.id,
      req.body,
    );
    sendSuccess(
      res,
      result,
      "Kalender ketersediaan agenda vendor berhasil diupdate",
    );
  } catch (err) {
    next(err);
  }
}
