import { Request, Response, NextFunction } from "express";
import * as rsvpService from "./rsvp.service";
import { sendSuccess } from "../../middlewares/error.middleware";
import type {
  CreateRsvpLinkInput,
  UpdateRsvpLinkInput,
  SubmitRsvpInput,
} from "./rsvp.schema";

// ============================================================================
// RSVP CONTROLLER (STRICT GENERIC TYPING)
// ============================================================================

// ── A. PRIVATE (client/admin) ───────────────────────────────────────────────

export async function createRsvpLink(
  req: Request<{ orderId: string }, any, CreateRsvpLinkInput>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await rsvpService.createRsvpLink(
      req.params.orderId,
      req.user!.id,
      req.user!.role,
      req.body,
    );
    sendSuccess(res, result, "Link RSVP berhasil dibuat", 201);
  } catch (err) {
    next(err);
  }
}

export async function getRsvpLinkByOrder(
  req: Request<{ orderId: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await rsvpService.getRsvpLinkByOrder(
      req.params.orderId,
      req.user!.id,
      req.user!.role,
    );
    sendSuccess(res, result, "Konfigurasi link RSVP berhasil diambil");
  } catch (err) {
    next(err);
  }
}

export async function updateRsvpLink(
  req: Request<{ orderId: string }, any, UpdateRsvpLinkInput>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await rsvpService.updateRsvpLink(
      req.params.orderId,
      req.user!.id,
      req.user!.role,
      req.body,
    );
    sendSuccess(res, result, "Link RSVP berhasil diperbarui");
  } catch (err) {
    next(err);
  }
}

export async function getSubmissionsByOrder(
  req: Request<{ orderId: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await rsvpService.getSubmissionsByOrder(
      req.params.orderId,
      req.user!.id,
      req.user!.role,
    );
    sendSuccess(res, result, "Daftar konfirmasi tamu berhasil diambil");
  } catch (err) {
    next(err);
  }
}

// ── B. PUBLIC (tanpa auth) ──────────────────────────────────────────────────

export async function getPublicEventDetail(
  req: Request<{ slug: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await rsvpService.getPublicEventDetail(req.params.slug);
    sendSuccess(res, result, "Detail acara berhasil diambil");
  } catch (err) {
    next(err);
  }
}

export async function submitRsvp(
  req: Request<{ slug: string }, any, SubmitRsvpInput>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await rsvpService.submitRsvp(req.params.slug, req.body);
    sendSuccess(
      res,
      result,
      "Konfirmasi kehadiran berhasil dikirim. Terima kasih!",
      201,
    );
  } catch (err) {
    next(err);
  }
}

export async function getPublicWishes(
  req: Request<{ slug: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await rsvpService.getPublicWishes(req.params.slug);
    sendSuccess(res, result, "Daftar ucapan tamu berhasil diambil");
  } catch (err) {
    next(err);
  }
}
