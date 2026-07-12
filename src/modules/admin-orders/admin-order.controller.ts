import { Request, Response, NextFunction } from "express";
import * as adminOrderService from "./admin-order.service";
import { sendSuccess } from "../../middlewares/error.middleware";
import type { ListOrdersQuery, CancelOrderInput } from "./admin-order.schema";

// ============================================================================
// ADMIN ORDER CONTROLLER (STRICT GENERIC TYPING)
// ============================================================================

export async function listOrders(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // Cast manual — ParsedQs bawaan Express tidak kompatibel dengan tipe
    // hasil coercion Zod (page/limit: number, weddingDateFrom/To: Date)
    const query = req.query as unknown as ListOrdersQuery;
    const result = await adminOrderService.listOrders(query);
    sendSuccess(res, result, "Daftar pesanan berhasil diambil");
  } catch (err) {
    next(err);
  }
}

export async function getOrderDetail(
  req: Request<{ orderId: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await adminOrderService.getOrderDetail(req.params.orderId);
    sendSuccess(res, result, "Detail pesanan berhasil diambil");
  } catch (err) {
    next(err);
  }
}

export async function cancelOrder(
  req: Request<{ orderId: string }, any, CancelOrderInput>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await adminOrderService.cancelOrder(
      req.params.orderId,
      req.body,
    );
    sendSuccess(res, result, "Pesanan berhasil dibatalkan");
  } catch (err) {
    next(err);
  }
}
