import { Request, Response, NextFunction } from "express";
import * as orderService from "./order.service";
import { sendSuccess } from "@/middlewares/error.middleware";
import {
  CreateOrderDraftInput,
  UpdateOrderDraftInput,
  GetOrdersQueryInput,
} from "./order.schema";

// ============================================================================
// ORDER CONTROLLER (EXPLICIT GENERIC TYPING)
// ============================================================================

export async function createOrderDraft(
  req: Request<any, any, CreateOrderDraftInput>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await orderService.createOrderDraft(req.user!.id, req.body);
    sendSuccess(
      res,
      result,
      "Draf formulir pesanan berhasil diinisialisasi",
      201,
    );
  } catch (err) {
    next(err);
  }
}

export async function updateOrderDraft(
  req: Request<{ id: string }, any, UpdateOrderDraftInput>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await orderService.updateOrderDraft(
      req.params.id,
      req.user!.id,
      req.body,
    );
    sendSuccess(
      res,
      result,
      "Progres multi-step form berhasil disimpan ke draf",
    );
  } catch (err) {
    next(err);
  }
}

export async function submitOrder(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await orderService.submitOrder(req.params.id, req.user!.id);
    sendSuccess(
      res,
      result,
      "Pesanan pernikahan berhasil diajukan, silakan selesaikan pembayaran DP",
    );
  } catch (err) {
    next(err);
  }
}

export async function cancelOrder(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await orderService.cancelOrder(req.params.id, req.user!.id);
    sendSuccess(res, result, "Pesanan pernikahan berhasil dibatalkan");
  } catch (err) {
    next(err);
  }
}

export async function getClientOrders(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await orderService.getClientOrders(req.user!.id);
    sendSuccess(res, result, "Riwayat daftar pesanan klien berhasil diambil");
  } catch (err) {
    next(err);
  }
}

export async function getAllOrdersForAdmin(
  req: Request<any, any, any, GetOrdersQueryInput>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await orderService.getAllOrdersForAdmin(req.query.status);
    sendSuccess(
      res,
      result,
      "Seluruh master daftar pesanan sistem berhasil dimonitor admin",
    );
  } catch (err) {
    next(err);
  }
}

export async function getOrderById(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await orderService.getOrderById(
      req.params.id,
      req.user!.id,
      req.user!.role,
    );
    sendSuccess(res, result, "Detail rincian pesanan berhasil diambil");
  } catch (err) {
    next(err);
  }
}
