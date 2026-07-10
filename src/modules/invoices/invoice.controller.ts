import { Request, Response, NextFunction } from "express";
import * as invoiceService from "./invoice.service";
import { sendSuccess } from "../../middlewares/error.middleware";

// ============================================================================
// INVOICE CONTROLLER (STRICT GENERIC TYPING)
// ============================================================================

export async function getInvoicesByOrder(
  req: Request<{ orderId: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await invoiceService.getInvoicesByOrder(
      req.params.orderId,
      req.user!.id,
      req.user!.role,
    );
    sendSuccess(
      res,
      result,
      "Daftar invoice untuk pesanan ini berhasil diambil",
    );
  } catch (err) {
    next(err);
  }
}

export async function getInvoiceDetail(
  req: Request<{ invoiceNumber: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await invoiceService.getInvoiceDetail(
      req.params.invoiceNumber,
      req.user!.id,
      req.user!.role,
    );
    sendSuccess(res, result, "Detail rincian dokumen invoice berhasil diambil");
  } catch (err) {
    next(err);
  }
}

// 🆕 Jaring pengaman manual (admin-only): dipakai kalau createInvoice otomatis
// gagal di background saat payment.verifyPayment (mis. Puppeteer error, storage
// down saat itu). createInvoice sudah idempotent, jadi aman dipanggil ulang —
// kalau invoice untuk paymentId ini sudah ada, langsung dikembalikan, bukan dobel.
export async function regenerateInvoice(
  req: Request<{ paymentId: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await invoiceService.createInvoice(req.params.paymentId);
    sendSuccess(res, result, "Dokumen invoice berhasil dibuat/diambil ulang");
  } catch (err) {
    next(err);
  }
}
