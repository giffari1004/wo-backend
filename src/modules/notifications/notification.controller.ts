import { Request, Response, NextFunction } from "express";
import * as notificationService from "./notification.service";
import { sendSuccess } from "../../middlewares/error.middleware";
import type { ListNotificationQuery } from "./notification.schema";

// ============================================================================
// NOTIFICATION CONTROLLER (STRICT GENERIC TYPING)
// ============================================================================
//
// Semua endpoint di sini SELALU beroperasi atas notifikasi milik
// `req.user!.id` sendiri — tidak ada bypass admin, karena notifikasi memang
// murni personal per user (beda dengan order/payment/dst yang admin boleh
// lihat milik siapa saja).

export async function getMyNotifications(
  // FIX: generic query dibiarkan default (ParsedQs) supaya kompatibel
  // dengan signature Express Router. Data query yang sudah divalidasi
  // dan di-transform Zod dicast secara eksplisit di dalam handler,
  // bukan di level generic — ini pola yang benar untuk avoid mismatch
  // antara ParsedQs (pre-middleware) dan tipe transformed (post-middleware)
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // Cast eksplisit setelah validate middleware berjalan —
    // pada titik ini req.query sudah pasti berbentuk ListNotificationQuery
    const query = req.query as unknown as ListNotificationQuery;
    const result = await notificationService.getMyNotifications(
      req.user!.id,
      query,
    );
    sendSuccess(res, result, "Daftar notifikasi berhasil diambil");
  } catch (err) {
    next(err);
  }
}

export async function getUnreadCount(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const count = await notificationService.getUnreadCount(req.user!.id);
    sendSuccess(
      res,
      { unreadCount: count },
      "Jumlah notifikasi belum dibaca berhasil diambil",
    );
  } catch (err) {
    next(err);
  }
}

export async function markAsRead(
  req: Request<{ notificationId: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await notificationService.markAsRead(
      req.user!.id,
      req.params.notificationId,
    );
    sendSuccess(res, result, "Notifikasi ditandai sudah dibaca");
  } catch (err) {
    next(err);
  }
}

export async function markAllAsRead(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await notificationService.markAllAsRead(req.user!.id);
    sendSuccess(res, result, "Semua notifikasi ditandai sudah dibaca");
  } catch (err) {
    next(err);
  }
}

export async function deleteNotification(
  req: Request<{ notificationId: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await notificationService.deleteNotification(
      req.user!.id,
      req.params.notificationId,
    );
    sendSuccess(res, null, "Notifikasi berhasil dihapus");
  } catch (err) {
    next(err);
  }
}
