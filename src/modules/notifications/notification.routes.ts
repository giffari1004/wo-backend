import { Router } from "express";
import * as notificationController from "./notification.controller";
import { validate } from "../../middlewares/validate.middleware";
import { authenticate } from "../../middlewares/auth.middleware";
import {
  notificationIdParamSchema,
  listNotificationQuerySchema,
} from "./notification.schema";

const notificationRoutes = Router();

notificationRoutes.use(authenticate);

// ============================================================================
// NOTIFICATION ROUTES (Base Path: /api/v1/notifications)
// ============================================================================
//
// Semua endpoint self-service (client & admin sama-sama cuma bisa akses
// notifikasi milik mereka sendiri) — tidak ada endpoint admin-only di sini.

notificationRoutes.get(
  "/",
  validate(listNotificationQuerySchema, "query"),
  notificationController.getMyNotifications,
);

notificationRoutes.get("/unread-count", notificationController.getUnreadCount);

notificationRoutes.patch("/read-all", notificationController.markAllAsRead);

notificationRoutes.patch(
  "/:notificationId/read",
  validate(notificationIdParamSchema, "params"),
  notificationController.markAsRead,
);

notificationRoutes.delete(
  "/:notificationId",
  validate(notificationIdParamSchema, "params"),
  notificationController.deleteNotification,
);

export default notificationRoutes;
