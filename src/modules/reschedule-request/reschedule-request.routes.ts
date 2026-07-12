import { Router } from "express";
import { authenticate, authorize } from "@/middlewares/auth.middleware";
import { validate } from "@/middlewares/validate.middleware";
import { rescheduleRequestController } from "./reschedule-request.controller";
import { UserRole } from "@prisma/client";
import {
  createRescheduleRequestSchema,
  approveRescheduleRequestSchema,
  rejectRescheduleRequestSchema,
  listRescheduleRequestQuerySchema,
} from "./reschedule-request.schema";

const router = Router();

// ── Client-facing routes (nested di bawah order) ───────────────────
router.post(
  "/orders/:orderId/reschedule",
  authenticate,
  authorize(UserRole.CLIENT),
  validate(createRescheduleRequestSchema),
  rescheduleRequestController.create,
);

router.get(
  "/orders/:orderId/reschedule",
  authenticate,
  authorize(UserRole.CLIENT),
  rescheduleRequestController.listByOrder,
);

// ── Admin routes ─────────────────────────────────────────────────
router.get(
  "/admin/reschedule",
  authenticate,
  authorize(UserRole.ADMIN),
  validate(listRescheduleRequestQuerySchema, "query"),
  rescheduleRequestController.listAllForAdmin,
);

router.get(
  "/admin/reschedule/:id",
  authenticate,
  authorize(UserRole.ADMIN),
  rescheduleRequestController.getById,
);

router.get(
  "/admin/reschedule/:id/conflicts",
  authenticate,
  authorize(UserRole.ADMIN),
  rescheduleRequestController.previewConflicts,
);

router.patch(
  "/admin/reschedule/:id/approve",
  authenticate,
  authorize(UserRole.ADMIN),
  validate(approveRescheduleRequestSchema),
  rescheduleRequestController.approve,
);

router.patch(
  "/admin/reschedule/:id/reject",
  authenticate,
  authorize(UserRole.ADMIN),
  validate(rejectRescheduleRequestSchema),
  rescheduleRequestController.reject,
);

export default router;
