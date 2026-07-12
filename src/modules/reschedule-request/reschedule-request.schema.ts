import { z } from "zod";

export const createRescheduleRequestSchema = z
  .object({
    // 🔴 FIX Zod v4: `required_error` sudah tidak berlaku (API v3),
    // disatukan jadi `message` — pola sama seperti fix errorMap di client-request.schema.ts
    requestedDate: z.coerce.date({
      message: "Tanggal baru wajib diisi dan harus format tanggal yang valid",
    }),
    reason: z.string().min(5, "Alasan minimal 5 karakter").max(1000).optional(),
  })
  .refine((data) => data.requestedDate.getTime() > Date.now(), {
    message: "Tanggal baru harus di masa depan",
    path: ["requestedDate"],
  });

export const approveRescheduleRequestSchema = z.object({
  adminNote: z.string().max(1000).optional(),
});

export const rejectRescheduleRequestSchema = z.object({
  adminNote: z.string().min(3, "Alasan penolakan wajib diisi").max(1000),
});

export const listRescheduleRequestQuerySchema = z.object({
  status: z.enum(["PENDING", "RESPONDED", "APPROVED", "REJECTED"]).optional(),
  // 🆕 Filter per order — dipakai admin di halaman Detail Order (PRD 6.2)
  // supaya bisa lihat riwayat reschedule khusus order yang sedang dibuka,
  // bukan cuma daftar global ter-paginasi.
  orderId: z
    .string()
    .cuid({ message: "Format ID Pesanan tidak valid" })
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateRescheduleRequestInput = z.infer<
  typeof createRescheduleRequestSchema
>;
export type ApproveRescheduleRequestInput = z.infer<
  typeof approveRescheduleRequestSchema
>;
export type RejectRescheduleRequestInput = z.infer<
  typeof rejectRescheduleRequestSchema
>;
export type ListRescheduleRequestQuery = z.infer<
  typeof listRescheduleRequestQuerySchema
>;
