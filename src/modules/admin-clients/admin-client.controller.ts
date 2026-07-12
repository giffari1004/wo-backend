import { Request, Response, NextFunction } from "express";
import * as adminClientService from "./admin-client.service";
import { sendSuccess } from "../../middlewares/error.middleware";
import type { ListClientsQuery } from "./admin-client.schema";

// ============================================================================
// ADMIN CLIENT CONTROLLER (STRICT GENERIC TYPING)
// ============================================================================

export async function listClients(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // Cast manual — ParsedQs bawaan Express tidak kompatibel dengan tipe
    // hasil coercion Zod (page/limit: number)
    const query = req.query as unknown as ListClientsQuery;
    const result = await adminClientService.listClients(query);
    sendSuccess(res, result, "Daftar client berhasil diambil");
  } catch (err) {
    next(err);
  }
}

export async function getClientDetail(
  req: Request<{ clientId: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await adminClientService.getClientDetail(
      req.params.clientId,
    );
    sendSuccess(res, result, "Detail client berhasil diambil");
  } catch (err) {
    next(err);
  }
}
