import { Request, Response, NextFunction } from "express";
import * as cateringMenuService from "./catering-menu.service";
import { sendSuccess } from "@/middlewares/error.middleware";

// ============================================================================
// CATERING MENU CONTROLLER
// Interface parameter didefinisikan eksplisit untuk mengunci type-safety Express
// ============================================================================

export async function getMenusByVendor(
  req: Request<{ vendorId: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await cateringMenuService.getMenusByVendor(
      req.params.vendorId,
    );
    sendSuccess(
      res,
      result,
      "Daftar paket menu katering vendor berhasil diambil",
    );
  } catch (err) {
    next(err);
  }
}

export async function getAllMenusForAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // Perbaikan Isu 3: Handler controller khusus admin
    const result = await cateringMenuService.getAllMenusForAdmin();
    sendSuccess(
      res,
      result,
      "Seluruh master daftar menu katering admin berhasil diambil",
    );
  } catch (err) {
    next(err);
  }
}

export async function getMenuById(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await cateringMenuService.getMenuById(req.params.id);
    sendSuccess(res, result, "Detail menu katering berhasil diambil");
  } catch (err) {
    next(err);
  }
}

export async function createCateringMenu(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await cateringMenuService.createCateringMenu(req.body);
    sendSuccess(res, result, "Menu katering baru berhasil ditambahkan", 201);
  } catch (err) {
    next(err);
  }
}

export async function updateCateringMenu(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await cateringMenuService.updateCateringMenu(
      req.params.id,
      req.body,
    );
    sendSuccess(res, result, "Data menu katering berhasil diperbarui");
  } catch (err) {
    next(err);
  }
}

export async function deleteCateringMenu(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await cateringMenuService.deleteCateringMenu(req.params.id);
    sendSuccess(res, null, "Menu katering berhasil dihapus dari sistem");
  } catch (err) {
    next(err);
  }
}
