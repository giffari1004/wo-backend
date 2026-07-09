import { Request, Response, NextFunction } from "express";
import * as orderVendorService from "./order-vendor.service";
import { sendSuccess } from "@/middlewares/error.middleware";
import { SelectVendorInput } from "./order-vendor.schema";
import { VendorCategory } from "@prisma/client";

// ============================================================================
// ORDER VENDOR CONTROLLER (STRICT GENERIC TYPING)
// ============================================================================

export async function selectVendor(
  req: Request<any, any, SelectVendorInput>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await orderVendorService.selectVendor(
      req.user!.id,
      req.body,
    );
    sendSuccess(
      res,
      result,
      "Pilihan vendor berhasil disimpan untuk tahapan ini",
    );
  } catch (err) {
    next(err);
  }
}

export async function getVendorsByOrder(
  req: Request<{ orderId: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await orderVendorService.getVendorsByOrder(
      req.params.orderId,
      req.user!.id,
      req.user!.role,
    );
    sendSuccess(
      res,
      result,
      "Daftar vendor terpilih untuk pesanan ini berhasil diambil",
    );
  } catch (err) {
    next(err);
  }
}

export async function getVendorByCategory(
  req: Request<{ orderId: string; category: VendorCategory }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await orderVendorService.getVendorByCategory(
      req.params.orderId,
      req.params.category,
      req.user!.id,
      req.user!.role,
    );
    sendSuccess(
      res,
      result,
      "Detail vendor terpilih untuk kategori ini berhasil diambil",
    );
  } catch (err) {
    next(err);
  }
}
