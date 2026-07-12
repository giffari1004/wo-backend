import { Router } from "express";
import { authenticate, authorize } from "@/middlewares/auth.middleware";
import { validate } from "@/middlewares/validate.middleware";
import { clientRequestController } from "./client-request.controller";
import { UserRole } from "@prisma/client";
import {
  createClientRequestSchema,
  replyClientRequestSchema,
  listClientRequestQuerySchema,
} from "./client-request.schema";

const router = Router();

// ── Client-facing routes (nested di bawah order) ───────────────────
router.post(
  "/orders/:orderId/requests",
  authenticate,
  authorize(UserRole.CLIENT),
  validate(createClientRequestSchema),
  clientRequestController.create,
);

router.get(
  "/orders/:orderId/requests",
  authenticate,
  authorize(UserRole.CLIENT),
  clientRequestController.listByOrder,
);

// ── Admin routes ─────────────────────────────────────────────────
router.get(
  "/admin/requests",
  authenticate,
  authorize(UserRole.ADMIN),
  validate(listClientRequestQuerySchema, "query"),
  clientRequestController.listAllForAdmin,
);

router.get(
  "/admin/requests/:id",
  authenticate,
  authorize(UserRole.ADMIN),
  clientRequestController.getById,
);

router.patch(
  "/admin/requests/:id/reply",
  authenticate,
  authorize(UserRole.ADMIN),
  validate(replyClientRequestSchema),
  clientRequestController.reply,
);

export default router;
