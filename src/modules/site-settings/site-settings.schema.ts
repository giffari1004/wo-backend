import { z } from "zod";

// ============================================================================
// ADMIN SETTINGS VALIDATION SCHEMA
// ============================================================================

// ── A. Bank Accounts (PaymentAccount) ───────────────────────────────────

export const bankAccountIdParamSchema = z.object({
  bankAccountId: z
    .string({ message: "ID Rekening Bank wajib diisi" })
    .cuid({ message: "Format ID Rekening Bank tidak valid" }),
});

export const createBankAccountSchema = z.object({
  bankName: z
    .string({ message: "Nama bank wajib diisi" })
    .trim()
    .min(2, { message: "Nama bank minimal 2 karakter" })
    .max(100, { message: "Nama bank maksimal 100 karakter" }),

  accountNumber: z
    .string({ message: "Nomor rekening wajib diisi" })
    .trim()
    .min(4, { message: "Nomor rekening minimal 4 karakter" })
    .max(50, { message: "Nomor rekening maksimal 50 karakter" }),

  accountHolder: z
    .string({ message: "Nama pemilik rekening wajib diisi" })
    .trim()
    .min(2, { message: "Nama pemilik rekening minimal 2 karakter" })
    .max(100, { message: "Nama pemilik rekening maksimal 100 karakter" }),
});

export const updateBankAccountSchema = z
  .object({
    bankName: z.string().trim().min(2).max(100).optional(),
    accountNumber: z.string().trim().min(4).max(50).optional(),
    accountHolder: z.string().trim().min(2).max(100).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: "Minimal satu field harus diisi untuk memperbarui rekening",
  });

export const listBankAccountsQuerySchema = z.object({
  // Default cuma tampilkan yang aktif — admin perlu eksplisit minta yang
  // nonaktif juga (mis. untuk lihat histori rekening lama)
  includeInactive: z
    .enum(["true", "false"], {
      message: "includeInactive harus 'true' atau 'false'",
    })
    .optional()
    .transform((val) => val === "true"),
});

// ── B. Site Settings (key-value) ────────────────────────────────────────

export const siteSettingKeyParamSchema = z.object({
  key: z
    .string({ message: "Key setting wajib diisi" })
    .trim()
    .min(1, { message: "Key tidak boleh kosong" })
    .max(100, { message: "Key maksimal 100 karakter" })
    .regex(/^[a-z0-9_]+$/, {
      message:
        "Key hanya boleh huruf kecil, angka, dan underscore (snake_case), contoh: terms_and_conditions",
    }),
});

export const upsertSiteSettingSchema = z.object({
  value: z
    .string({ message: "Value wajib diisi" })
    .min(1, { message: "Value tidak boleh kosong" }),
});

export type CreateBankAccountInput = z.infer<typeof createBankAccountSchema>;
export type UpdateBankAccountInput = z.infer<typeof updateBankAccountSchema>;
export type ListBankAccountsQuery = z.infer<typeof listBankAccountsQuerySchema>;
export type UpsertSiteSettingInput = z.infer<typeof upsertSiteSettingSchema>;
