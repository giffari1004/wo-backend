import { Request, Response, NextFunction } from "express";
import * as siteSettingsService from "./public-site-settings.service";
import { sendSuccess } from "../../middlewares/error.middleware";

// ============================================================================
// PUBLIC SITE SETTINGS CONTROLLER (STRICT GENERIC TYPING)
// ============================================================================

export async function listPublicSiteSettings(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await siteSettingsService.listPublicSiteSettings();
    sendSuccess(res, result, "Daftar konten publik berhasil diambil");
  } catch (err) {
    next(err);
  }
}

export async function getPublicSiteSetting(
  req: Request<{ key: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await siteSettingsService.getPublicSiteSetting(
      req.params.key,
    );
    sendSuccess(res, result, "Konten berhasil diambil");
  } catch (err) {
    next(err);
  }
}
