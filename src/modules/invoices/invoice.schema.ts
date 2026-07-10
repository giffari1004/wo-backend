import { z } from "zod";

// ============================================================================
// INVOICE VALIDATION SCHEMA (STRICT PARAMETER CHECKS)
// ============================================================================

export const invoiceIdParamSchema = z.object({
  invoiceNumber: z
    .string({ message: "Nomor Invoice wajib disertakan" })
    // 🔴 FIX: sebelumnya hardcode "INV-2026-..." — akan menolak semua invoice
    // yang dibuat di tahun selain 2026. Sekarang generik untuk 4 digit tahun berapa pun.
    .regex(/^INV-\d{4}-\d+$/, {
      message: "Format nomor invoice tidak valid",
    }),
});

export const orderIdParamSchema = z.object({
  orderId: z.string().cuid({ message: "Format ID Pesanan tidak valid" }),
});

// 🆕 Dipakai untuk endpoint regenerate invoice manual (admin)
export const paymentIdParamSchema = z.object({
  paymentId: z.string().cuid({ message: "Format ID Pembayaran tidak valid" }),
});

export type InvoiceIdParam = z.infer<typeof invoiceIdParamSchema>;
export type OrderIdParam = z.infer<typeof orderIdParamSchema>;
export type PaymentIdParam = z.infer<typeof paymentIdParamSchema>;
