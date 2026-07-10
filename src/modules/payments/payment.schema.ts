import { z } from "zod";
import { PaymentStatus } from "@prisma/client";

// ============================================================================
// PAYMENT VALIDATION SCHEMA (STRICT PRECISE CHECKS)
// ============================================================================

export const paymentIdParamSchema = z.object({
  paymentId: z.string().cuid({ message: "Format ID Pembayaran tidak valid" }),
});

export const orderIdParamSchema = z.object({
  orderId: z.string().cuid({ message: "Format ID Pesanan tidak valid" }),
});

export const uploadProofSchema = z.object({
  amountTransferred: z
    .string({ message: "Nominal transfer wajib diisi" })
    .transform((val) => Number(val))
    .refine((val) => val > 0, {
      message: "Nominal transfer harus lebih besar dari 0",
    }),
  transferDate: z
    .string({ message: "Tanggal transfer wajib diisi" })
    .transform((val) => new Date(val))
    // 🔴 SOLUSI BUG #5: Validasi instan objek penanggalan untuk menghindari kegagalan internal DB[cite: 7]
    .refine((date) => !isNaN(date.getTime()), {
      message: "Format tanggal transfer tidak valid atau tidak dikenali",
    }),
  bankAccountId: z
    .string({ message: "Rekening bank tujuan wajib diisi" })
    .cuid({ message: "Format ID Rekening Bank tidak valid" }),
});

export const verifyPaymentSchema = z
  .object({
    status: z.enum([PaymentStatus.APPROVED, PaymentStatus.REJECTED], {
      message: "Status verifikasi harus APPROVED atau REJECTED",
    }),
    rejectionReason: z.string().optional().nullable(),
  })
  .refine(
    (data) => data.status !== PaymentStatus.REJECTED || !!data.rejectionReason,
    {
      message: "Alasan penolakan wajib diisi jika status pembayaran REJECTED",
      path: ["rejectionReason"],
    },
  );

export type UploadProofInput = z.infer<typeof uploadProofSchema>;
export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;
