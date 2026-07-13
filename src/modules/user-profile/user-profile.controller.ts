import { Request, Response, NextFunction } from "express";
import * as userProfileService from "./user-profile.service";
import { sendSuccess } from "../../middlewares/error.middleware";
import type { UpdateProfileInput } from "./user-profile.schema";

// ============================================================================
// USER PROFILE CONTROLLER (STRICT GENERIC TYPING)
// ============================================================================

export async function getMyProfile(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await userProfileService.getMyProfile(req.user!.id);
    sendSuccess(res, result, "Profil berhasil diambil");
  } catch (err) {
    next(err);
  }
}

export async function updateMyProfile(
  req: Request<{}, any, UpdateProfileInput>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await userProfileService.updateMyProfile(
      req.user!.id,
      req.body,
    );
    sendSuccess(res, result, "Profil berhasil diperbarui");
  } catch (err) {
    next(err);
  }
}
