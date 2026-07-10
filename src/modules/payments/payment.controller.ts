import { Request, Response, NextFunction } from "express";
import * as paymentService from "./payment.service";
import { sendSuccess, AppError } from "../../middlewares/error.middleware";
import type { UploadProofInput, VerifyPaymentInput } from "./payment.schema";

// ============================================================================
// PAYMENT CONTROLLER (STRICT GENERIC TYPING)
// ============================================================================

export async function uploadProof(
  req: Request<{ paymentId: string }, any, UploadProofInput>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.file) {
      throw new AppError(
        "File bukti transfer gambar/PDF wajib dilampirkan",
        400,
      );
    }

    const result = await paymentService.uploadProof(
      req.user!.id,
      req.params.paymentId,
      req.body,
      req.file,
    );
    sendSuccess(
      res,
      result,
      "Bukti transfer berhasil diunggah, menunggu verifikasi admin",
    );
  } catch (err) {
    next(err);
  }
}

export async function verifyPayment(
  req: Request<{ paymentId: string }, any, VerifyPaymentInput>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await paymentService.verifyPayment(
      req.user!.id,
      req.params.paymentId,
      req.body,
    );
    sendSuccess(
      res,
      result,
      `Verifikasi pembayaran selesai dengan keputusan: ${req.body.status}`,
    );
  } catch (err) {
    next(err);
  }
}

export async function getPaymentsByOrder(
  req: Request<{ orderId: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await paymentService.getPaymentsByOrder(
      req.params.orderId,
      req.user!.id,
      req.user!.role,
    );
    sendSuccess(
      res,
      result,
      "Riwayat pembayaran untuk pesanan ini berhasil diambil",
    );
  } catch (err) {
    next(err);
  }
}

export async function getAdminVerificationQueue(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await paymentService.getAdminVerificationQueue();
    sendSuccess(
      res,
      result,
      "Antrean bukti transfer pembayaran berhasil diambil",
    );
  } catch (err) {
    next(err);
  }
}
