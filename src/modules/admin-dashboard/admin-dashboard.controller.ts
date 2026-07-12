import { Request, Response, NextFunction } from "express";
import * as adminDashboardService from "./admin-dashboard.service";
import { sendSuccess } from "../../middlewares/error.middleware";
import type { DashboardQuery } from "./admin-dashboard.schema";

// ============================================================================
// ADMIN DASHBOARD CONTROLLER (STRICT GENERIC TYPING)
// ============================================================================

export async function getOverview(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // 🔴 FIX: sebelumnya `Request<{}, any, any, DashboardQuery>` — Express
    // menolak ini karena tipe query bawaannya (ParsedQs) semua value-nya
    // string, sedangkan DashboardQuery (hasil coercion Zod) punya
    // `upcomingLimit: number`. TypeScript tidak bisa membuktikan secara
    // statis req.query sudah dalam bentuk itu, walau middleware `validate()`
    // memang benar-benar mengubahnya di runtime — jadi di-cast manual di sini.
    const query = req.query as unknown as DashboardQuery;
    const result = await adminDashboardService.getOverview(query);
    sendSuccess(res, result, "Ringkasan dashboard admin berhasil diambil");
  } catch (err) {
    next(err);
  }
}
