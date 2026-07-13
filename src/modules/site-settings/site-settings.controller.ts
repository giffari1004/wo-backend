import { Request, Response, NextFunction } from "express";
import * as adminSettingsService from "./site-settings.service";
import { sendSuccess } from "../../middlewares/error.middleware";
import type {
  CreateBankAccountInput,
  UpdateBankAccountInput,
  ListBankAccountsQuery,
  UpsertSiteSettingInput,
} from "./site-settings.schema";

// ============================================================================
// ADMIN SETTINGS CONTROLLER (STRICT GENERIC TYPING)
// ============================================================================

// ── A. Bank Accounts ─────────────────────────────────────────────────────

export async function createBankAccount(
  req: Request<{}, any, CreateBankAccountInput>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await adminSettingsService.createBankAccount(req.body);
    sendSuccess(res, result, "Rekening bank berhasil ditambahkan", 201);
  } catch (err) {
    next(err);
  }
}

export async function listBankAccounts(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // Cast manual — ParsedQs bawaan Express tidak kompatibel dengan tipe
    // hasil transform Zod (includeInactive: boolean)
    const query = req.query as unknown as ListBankAccountsQuery;
    const result = await adminSettingsService.listBankAccounts(query);
    sendSuccess(res, result, "Daftar rekening bank berhasil diambil");
  } catch (err) {
    next(err);
  }
}

export async function getBankAccountDetail(
  req: Request<{ bankAccountId: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await adminSettingsService.getBankAccountDetail(
      req.params.bankAccountId,
    );
    sendSuccess(res, result, "Detail rekening bank berhasil diambil");
  } catch (err) {
    next(err);
  }
}

export async function updateBankAccount(
  req: Request<{ bankAccountId: string }, any, UpdateBankAccountInput>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await adminSettingsService.updateBankAccount(
      req.params.bankAccountId,
      req.body,
    );
    sendSuccess(res, result, "Rekening bank berhasil diperbarui");
  } catch (err) {
    next(err);
  }
}

export async function deleteBankAccount(
  req: Request<{ bankAccountId: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await adminSettingsService.deleteBankAccount(req.params.bankAccountId);
    sendSuccess(res, null, "Rekening bank berhasil dihapus");
  } catch (err) {
    next(err);
  }
}

// ── B. Site Settings ─────────────────────────────────────────────────────

export async function listSiteSettings(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await adminSettingsService.listSiteSettings();
    sendSuccess(res, result, "Daftar site settings berhasil diambil");
  } catch (err) {
    next(err);
  }
}

export async function getSiteSetting(
  req: Request<{ key: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await adminSettingsService.getSiteSetting(req.params.key);
    sendSuccess(res, result, "Site setting berhasil diambil");
  } catch (err) {
    next(err);
  }
}

export async function upsertSiteSetting(
  req: Request<{ key: string }, any, UpsertSiteSettingInput>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await adminSettingsService.upsertSiteSetting(
      req.params.key,
      req.body,
    );
    sendSuccess(res, result, "Site setting berhasil disimpan");
  } catch (err) {
    next(err);
  }
}

export async function deleteSiteSetting(
  req: Request<{ key: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await adminSettingsService.deleteSiteSetting(req.params.key);
    sendSuccess(res, null, "Site setting berhasil dihapus");
  } catch (err) {
    next(err);
  }
}
