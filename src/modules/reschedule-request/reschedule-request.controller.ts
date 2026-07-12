import { Request, Response, NextFunction } from "express";
import { sendSuccess } from "@/middlewares/error.middleware";
import { rescheduleRequestService } from "./reschedule-request.service";
import type {
  CreateRescheduleRequestInput,
  ApproveRescheduleRequestInput,
  RejectRescheduleRequestInput,
  ListRescheduleRequestQuery,
} from "./reschedule-request.schema";

export const rescheduleRequestController = {
  // POST /orders/:orderId/reschedule
  async create(
    req: Request<{ orderId: string }, any, CreateRescheduleRequestInput>,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const { orderId } = req.params;
      const data = await rescheduleRequestService.create(
        orderId,
        req.user!.id,
        req.body,
      );
      return sendSuccess(
        res,
        data,
        "Pengajuan reschedule berhasil dikirim, menunggu persetujuan admin",
        201,
      );
    } catch (err) {
      next(err);
    }
  },

  // GET /orders/:orderId/reschedule
  async listByOrder(
    req: Request<{ orderId: string }>,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const { orderId } = req.params;
      const data = await rescheduleRequestService.listByOrder(
        orderId,
        req.user!.id,
      );
      return sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  },

  // GET /admin/reschedule
  async listAllForAdmin(req: Request, res: Response, next: NextFunction) {
    try {
      // Cast manual — sama seperti controller lain, ParsedQs bawaan Express
      // tidak kompatibel dengan tipe hasil coercion Zod (page/limit: number)
      const query = req.query as unknown as ListRescheduleRequestQuery;
      const data = await rescheduleRequestService.listAllForAdmin(query);
      return sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  },

  // GET /admin/reschedule/:id
  async getById(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const { id } = req.params;
      const data = await rescheduleRequestService.getById(id);
      return sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  },

  // GET /admin/reschedule/:id/conflicts
  async previewConflicts(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const { id } = req.params;
      const data = await rescheduleRequestService.previewConflicts(id);
      return sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  },

  // PATCH /admin/reschedule/:id/approve
  async approve(
    req: Request<{ id: string }, any, ApproveRescheduleRequestInput>,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const { id } = req.params;
      const data = await rescheduleRequestService.approve(id, req.body);
      return sendSuccess(
        res,
        data,
        "Reschedule disetujui, tanggal acara telah diperbarui",
      );
    } catch (err) {
      next(err);
    }
  },

  // PATCH /admin/reschedule/:id/reject
  async reject(
    req: Request<{ id: string }, any, RejectRescheduleRequestInput>,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const { id } = req.params;
      const data = await rescheduleRequestService.reject(id, req.body);
      return sendSuccess(res, data, "Reschedule ditolak");
    } catch (err) {
      next(err);
    }
  },
};
