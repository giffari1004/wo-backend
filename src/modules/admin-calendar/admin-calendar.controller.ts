import { Request, Response, NextFunction } from "express";
import * as adminCalendarService from "./admin-calendar.service";
import { sendSuccess } from "../../middlewares/error.middleware";
import type {
  CalendarQuery,
  DayParam,
  ConflictsQuery,
} from "./admin-calendar.schema";

// ============================================================================
// ADMIN CALENDAR CONTROLLER (STRICT GENERIC TYPING)
// ============================================================================

export async function getCalendarMonth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // Cast manual — ParsedQs bawaan Express tidak kompatibel dengan tipe
    // hasil validasi Zod
    const query = req.query as unknown as CalendarQuery;
    const result = await adminCalendarService.getCalendarMonth(query);
    sendSuccess(res, result, "Data kalender berhasil diambil");
  } catch (err) {
    next(err);
  }
}

export async function getDayAgenda(
  req: Request<DayParam>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await adminCalendarService.getDayAgenda(req.params);
    sendSuccess(res, result, "Agenda tanggal berhasil diambil");
  } catch (err) {
    next(err);
  }
}

export async function getConflicts(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const query = req.query as unknown as ConflictsQuery;
    const result = await adminCalendarService.getConflicts(query);
    sendSuccess(res, result, "Daftar konflik penjadwalan berhasil diambil");
  } catch (err) {
    next(err);
  }
}
