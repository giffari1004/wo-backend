import { z } from "zod";

export const globalSearchQuerySchema = z.object({
  q: z
    .string({ message: "Kata kunci pencarian (q) wajib diisi" })
    .trim()
    .min(1, { message: "Kata kunci pencarian tidak boleh kosong" })
    .max(100, { message: "Kata kunci maksimal 100 karakter" }),

  scope: z.enum(["all", "orders", "clients", "vendors"]).default("all"),

  page: z.coerce.number().int().min(1).default(1),

  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export type GlobalSearchQueryInput = z.infer<typeof globalSearchQuerySchema>;
