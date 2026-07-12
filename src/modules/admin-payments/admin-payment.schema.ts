import { z } from "zod";
import { PaymentStatus, PaymentTermType } from "@prisma/client";

// ============================================================================
// ADMIN PAYMENT VALIDATION SCHEMA
// ============================================================================

export const paymentIdParamSchema = z.object({
  paymentId: z.string().cuid({ message: "Format ID Pembayaran tidak valid" }),
});

export const listPaymentsQuerySchema = z.object({
  status: z
    .nativeEnum(PaymentStatus, { message: "Status pembayaran tidak valid" })
    .optional(),
  termType: z
    .nativeEnum(PaymentTermType, { message: "Jenis termin tidak valid" })
    .optional(),
  orderId: z
    .string()
    .cuid({ message: "Format ID Pesanan tidak valid" })
    .optional(),

  // Cari berdasarkan nomor order ATAU nama/email client
  search: z.string().trim().min(1).max(100).optional(),

  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),

  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListPaymentsQuery = z.infer<typeof listPaymentsQuerySchema>;
