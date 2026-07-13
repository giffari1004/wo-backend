import { Request, Response, NextFunction } from "express";
import * as notificationService from "./notification.service";
import { sendSuccess } from "../../middlewares/error.middleware";
import type { ListNotificationQuery } from "./notification.schema";

// ============================================================================
// NOTIFICATION CONTROLLER (Base Path: /api/v1/notifications)
// ============================================================================

// Tipe params untuk route yang menggunakan /:notificationId
// Dipakai sebagai generic di Request<NotificationIdParams> supaya TypeScript
// tahu bahwa req.params.notificationId selalu bertipe string, bukan
// string | string[] | undefined (default ParamsDictionary Express 5 +
// noUncheckedIndexedAccess)
type NotificationIdParams = { notificationId: string };

export async function getMyNotifications(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
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
      { count },
      "Jumlah notifikasi belum dibaca berhasil diambil",
    );
  } catch (err) {
    next(err);
  }
}

export async function markAsRead(
  req: Request<NotificationIdParams>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // req.params.notificationId sudah dijamin ada dan berupa string melalui
    // validasi Zod params di router
    const result = await notificationService.markAsRead(
      req.user!.id,
      req.params.notificationId,
    );
    sendSuccess(res, result, "Notifikasi berhasil ditandai sudah dibaca");
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
    sendSuccess(res, result, "Semua notifikasi berhasil ditandai sudah dibaca");
  } catch (err) {
    next(err);
  }
}

export async function deleteNotification(
  req: Request<NotificationIdParams>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // req.params.notificationId sudah dijamin ada dan berupa string melalui
    // validasi Zod params di router
    await notificationService.deleteNotification(
      req.user!.id,
      req.params.notificationId,
    );
    sendSuccess(res, null, "Notifikasi berhasil dihapus");
  } catch (err) {
    next(err);
  }
}
