import { Request, Response, NextFunction } from "express";
import * as adminPaymentService from "./admin-payment.service";
import { sendSuccess } from "../../middlewares/error.middleware";
import type { ListPaymentsQuery } from "./admin-payment.schema";

// ============================================================================
// ADMIN PAYMENT CONTROLLER (STRICT GENERIC TYPING)
// ============================================================================

export async function listPayments(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // Cast manual — ParsedQs bawaan Express tidak kompatibel dengan tipe
    // hasil coercion Zod (page/limit: number, dateFrom/dateTo: Date)
    const query = req.query as unknown as ListPaymentsQuery;
    const result = await adminPaymentService.listPayments(query);
    sendSuccess(res, result, "Riwayat pembayaran berhasil diambil");
  } catch (err) {
    next(err);
  }
}

export async function getPaymentDetail(
  req: Request<{ paymentId: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await adminPaymentService.getPaymentDetail(
      req.params.paymentId,
    );
    sendSuccess(res, result, "Detail pembayaran berhasil diambil");
  } catch (err) {
    next(err);
  }
}
