import { z } from "zod";

// ============================================================================
// PUBLIC SITE SETTINGS VALIDATION SCHEMA
// ============================================================================

export const siteSettingKeyParamSchema = z.object({
  key: z
    .string({ message: "Key setting wajib diisi" })
    .trim()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9_]+$/, { message: "Format key tidak valid" }),
});

export type SiteSettingKeyParam = z.infer<typeof siteSettingKeyParamSchema>;
