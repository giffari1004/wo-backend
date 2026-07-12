import { z } from "zod";

export const createClientRequestSchema = z.object({
  subject: z.string().min(3, "Subjek minimal 3 karakter").max(150),
  message: z.string().min(10, "Pesan minimal 10 karakter").max(2000),
});

export const replyClientRequestSchema = z.object({
  adminReply: z.string().min(1, "Balasan wajib diisi").max(2000),
  status: z.enum(["RESPONDED", "APPROVED", "REJECTED"], {
    message: "Status harus RESPONDED, APPROVED, atau REJECTED",
  }),
});

export const listClientRequestQuerySchema = z.object({
  status: z.enum(["PENDING", "RESPONDED", "APPROVED", "REJECTED"]).optional(),
  // 🆕 Filter per order — sama seperti reschedule-request, dipakai admin di
  // halaman Detail Order (PRD 6.2) untuk lihat riwayat request khusus order ini.
  orderId: z
    .string()
    .cuid({ message: "Format ID Pesanan tidak valid" })
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateClientRequestInput = z.infer<
  typeof createClientRequestSchema
>;
export type ReplyClientRequestInput = z.infer<typeof replyClientRequestSchema>;
export type ListClientRequestQuery = z.infer<
  typeof listClientRequestQuerySchema
>;
