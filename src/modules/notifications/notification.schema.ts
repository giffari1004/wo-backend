import { z } from "zod";

// ============================================================================
// NOTIFICATION VALIDATION SCHEMA
// ============================================================================

export const notificationIdParamSchema = z.object({
  notificationId: z
    .string({ message: "ID Notifikasi wajib diisi" })
    .cuid({ message: "Format ID Notifikasi tidak valid" }),
});

export const listNotificationQuerySchema = z.object({
  // 🟡 SENGAJA tidak pakai z.coerce.boolean() di sini — itu jebakan umum:
  // z.coerce.boolean() memakai `Boolean(value)` JS, dan Boolean("false") === true
  // (string apa pun yang tidak kosong dianggap truthy). Jadi query
  // ?isRead=false akan salah kaprah dibaca sebagai `true`. Validasi manual
  // terhadap string "true"/"false" di bawah ini supaya benar-benar akurat.
  isRead: z
    .enum(["true", "false"], { message: "isRead harus 'true' atau 'false'" })
    .optional()
    .transform((val) => (val === undefined ? undefined : val === "true")),

  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListNotificationQuery = z.infer<typeof listNotificationQuerySchema>;
