import { Router } from "express";
import * as preparationController from "./preparation.controller";
import { validate } from "../../middlewares/validate.middleware";
import { authenticate, authorize } from "../../middlewares/auth.middleware";
import {
  orderIdParamSchema,
  taskIdParamSchema,
  createTaskSchema,
  updateTaskSchema,
} from "./preparation.schema";
import { UserRole } from "@prisma/client";

const preparationRoutes = Router();

preparationRoutes.use(authenticate);

// ============================================================================
// PREPARATION ROUTES (Base Path: /api/v1/preparation)
// ============================================================================
//
// Checklist persiapan dikelola sepenuhnya oleh ADMIN. Client hanya punya akses
// baca (GET) untuk melihat progress checklist pesanannya sendiri di dashboard.

// ── CLIENT & ADMIN: Lihat checklist persiapan satu order ───────────────────
preparationRoutes.get(
  "/order/:orderId",
  validate(orderIdParamSchema, "params"),
  preparationController.getTasksByOrder,
);

// ── ADMIN ONLY: Tambah tugas persiapan baru ─────────────────────────────────
preparationRoutes.post(
  "/order/:orderId",
  authorize(UserRole.ADMIN),
  validate(orderIdParamSchema, "params"),
  validate(createTaskSchema, "body"),
  preparationController.createTask,
);

// ── ADMIN ONLY: Update tugas (status, judul, deskripsi, tenggat, urutan) ───
preparationRoutes.patch(
  "/:taskId",
  authorize(UserRole.ADMIN),
  validate(taskIdParamSchema, "params"),
  validate(updateTaskSchema, "body"),
  preparationController.updateTask,
);

// ── ADMIN ONLY: Hapus tugas persiapan ───────────────────────────────────────
preparationRoutes.delete(
  "/:taskId",
  authorize(UserRole.ADMIN),
  validate(taskIdParamSchema, "params"),
  preparationController.deleteTask,
);

export default preparationRoutes;
