import { Request, Response, NextFunction } from "express";
import * as preparationService from "./preparation.service";
import { sendSuccess } from "../../middlewares/error.middleware";
import type { CreateTaskInput, UpdateTaskInput } from "./preparation.schema";

// ============================================================================
// PREPARATION CONTROLLER (STRICT GENERIC TYPING)
// ============================================================================

export async function createTask(
  req: Request<{ orderId: string }, any, CreateTaskInput>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await preparationService.createTask(
      req.user!.id,
      req.params.orderId,
      req.body,
    );
    sendSuccess(res, result, "Tugas persiapan berhasil ditambahkan", 201);
  } catch (err) {
    next(err);
  }
}

export async function getTasksByOrder(
  req: Request<{ orderId: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await preparationService.getTasksByOrder(
      req.params.orderId,
      req.user!.id,
      req.user!.role,
    );
    sendSuccess(
      res,
      result,
      "Checklist persiapan untuk pesanan ini berhasil diambil",
    );
  } catch (err) {
    next(err);
  }
}

export async function updateTask(
  req: Request<{ taskId: string }, any, UpdateTaskInput>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await preparationService.updateTask(
      req.user!.id,
      req.params.taskId,
      req.body,
    );
    sendSuccess(res, result, "Tugas persiapan berhasil diperbarui");
  } catch (err) {
    next(err);
  }
}

export async function deleteTask(
  req: Request<{ taskId: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await preparationService.deleteTask(req.params.taskId);
    sendSuccess(res, null, "Tugas persiapan berhasil dihapus");
  } catch (err) {
    next(err);
  }
}
