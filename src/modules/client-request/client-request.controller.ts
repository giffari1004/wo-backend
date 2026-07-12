import { Request, Response, NextFunction } from "express";
import { sendSuccess } from "@/middlewares/error.middleware";
import { clientRequestService } from "./client-request.service";
import type {
  CreateClientRequestInput,
  ReplyClientRequestInput,
  ListClientRequestQuery,
} from "./client-request.schema";

export const clientRequestController = {
  // POST /orders/:orderId/requests
  async create(
    req: Request<{ orderId: string }, any, CreateClientRequestInput>,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const { orderId } = req.params;
      const data = await clientRequestService.create(
        orderId,
        req.user!.id,
        req.body,
      );
      return sendSuccess(res, data, "Request khusus berhasil dikirim", 201);
    } catch (err) {
      next(err);
    }
  },

  // GET /orders/:orderId/requests
  async listByOrder(
    req: Request<{ orderId: string }>,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const { orderId } = req.params;
      const data = await clientRequestService.listByOrder(
        orderId,
        req.user!.id,
      );
      return sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  },

  // GET /admin/requests
  async listAllForAdmin(req: Request, res: Response, next: NextFunction) {
    try {
      // Cast manual — sama seperti admin-dashboard/notification, ParsedQs
      // bawaan Express tidak kompatibel dengan tipe hasil coercion Zod
      // (page/limit: number)
      const query = req.query as unknown as ListClientRequestQuery;
      const data = await clientRequestService.listAllForAdmin(query);
      return sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  },

  // GET /admin/requests/:id
  async getById(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const { id } = req.params;
      const data = await clientRequestService.getById(id);
      return sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  },

  // PATCH /admin/requests/:id/reply
  async reply(
    req: Request<{ id: string }, any, ReplyClientRequestInput>,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const { id } = req.params;
      const data = await clientRequestService.reply(id, req.body);
      return sendSuccess(res, data, "Balasan berhasil dikirim ke client");
    } catch (err) {
      next(err);
    }
  },
};
