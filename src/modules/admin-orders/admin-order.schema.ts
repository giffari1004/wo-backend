import { z } from "zod";
import { OrderStatus } from "@prisma/client";

// ============================================================================
// ADMIN ORDER VALIDATION SCHEMA
// ============================================================================

export const orderIdParamSchema = z.object({
  orderId: z.string().cuid({ message: "Format ID Pesanan tidak valid" }),
});

export const listOrdersQuerySchema = z.object({
  status: z
    .nativeEnum(OrderStatus, { message: "Status pesanan tidak valid" })
    .optional(),

  // Cari berdasarkan nomor order ATAU nama/email client — dipakai kotak
  // pencarian di halaman daftar order admin
  search: z.string().trim().min(1).max(100).optional(),

  weddingDateFrom: z.coerce.date().optional(),
  weddingDateTo: z.coerce.date().optional(),

  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const cancelOrderSchema = z.object({
  reason: z
    .string({ message: "Alasan pembatalan wajib diisi" })
    .trim()
    .min(5, { message: "Alasan pembatalan minimal 5 karakter" })
    .max(1000, { message: "Alasan pembatalan maksimal 1000 karakter" }),
});

export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;
