import { Router } from "express";
import * as adminSettingsController from "./site-settings.controller";
import { validate } from "../../middlewares/validate.middleware";
import { authenticate, authorize } from "../../middlewares/auth.middleware";
import {
  bankAccountIdParamSchema,
  createBankAccountSchema,
  updateBankAccountSchema,
  listBankAccountsQuerySchema,
  siteSettingKeyParamSchema,
  upsertSiteSettingSchema,
} from "./site-settings.schema";
import { UserRole } from "@prisma/client";

const adminSettingsRoutes = Router();

adminSettingsRoutes.use(authenticate, authorize(UserRole.ADMIN));

// ============================================================================
// ADMIN SETTINGS ROUTES (Base Path: /api/v1/admin/settings)
// ============================================================================

// ── A. Bank Accounts (rekening tujuan pembayaran) ───────────────────────────

adminSettingsRoutes.post(
  "/bank-accounts",
  validate(createBankAccountSchema, "body"),
  adminSettingsController.createBankAccount,
);

adminSettingsRoutes.get(
  "/bank-accounts",
  validate(listBankAccountsQuerySchema, "query"),
  adminSettingsController.listBankAccounts,
);

adminSettingsRoutes.get(
  "/bank-accounts/:bankAccountId",
  validate(bankAccountIdParamSchema, "params"),
  adminSettingsController.getBankAccountDetail,
);

adminSettingsRoutes.patch(
  "/bank-accounts/:bankAccountId",
  validate(bankAccountIdParamSchema, "params"),
  validate(updateBankAccountSchema, "body"),
  adminSettingsController.updateBankAccount,
);

adminSettingsRoutes.delete(
  "/bank-accounts/:bankAccountId",
  validate(bankAccountIdParamSchema, "params"),
  adminSettingsController.deleteBankAccount,
);

// ── B. Site Settings (key-value: terms_and_conditions, faq, dst) ───────────

adminSettingsRoutes.get("/site", adminSettingsController.listSiteSettings);

adminSettingsRoutes.get(
  "/site/:key",
  validate(siteSettingKeyParamSchema, "params"),
  adminSettingsController.getSiteSetting,
);

adminSettingsRoutes.put(
  "/site/:key",
  validate(siteSettingKeyParamSchema, "params"),
  validate(upsertSiteSettingSchema, "body"),
  adminSettingsController.upsertSiteSetting,
);

adminSettingsRoutes.delete(
  "/site/:key",
  validate(siteSettingKeyParamSchema, "params"),
  adminSettingsController.deleteSiteSetting,
);

export default adminSettingsRoutes;
