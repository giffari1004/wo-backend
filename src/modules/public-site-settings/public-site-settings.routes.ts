import { Router } from "express";
import * as siteSettingsController from "./public-site-settings.controller";
import { validate } from "../../middlewares/validate.middleware";
import { siteSettingKeyParamSchema } from "./public-site-settings.schema";

const siteSettingsRoutes = Router();

// ============================================================================
// PUBLIC SITE SETTINGS ROUTES (Base Path: /api/v1/site-settings)
// ============================================================================
//
// 🔴 SENGAJA TIDAK ADA `authenticate` di sini — ini memang halaman publik
// (landing page, FAQ, terms & conditions), diakses tanpa login. Proteksinya
// bukan lewat auth, tapi lewat whitelist key di service layer (lihat
// PUBLIC_SITE_SETTING_KEYS di site-settings.service.ts).

siteSettingsRoutes.get("/", siteSettingsController.listPublicSiteSettings);

siteSettingsRoutes.get(
  "/:key",
  validate(siteSettingKeyParamSchema, "params"),
  siteSettingsController.getPublicSiteSetting,
);

export default siteSettingsRoutes;
