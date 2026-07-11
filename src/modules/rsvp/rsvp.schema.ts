import { z } from "zod";
import { RsvpAttendance } from "@prisma/client";

// ============================================================================
// RSVP VALIDATION SCHEMA
// ============================================================================

export const orderIdParamSchema = z.object({
  orderId: z.string().cuid({ message: "Format ID Pesanan tidak valid" }),
});

// Slug dipakai di URL publik (/rsvp/:slug) — bukan cuid, jadi validasi terpisah
export const slugParamSchema = z.object({
  slug: z
    .string({ message: "Slug RSVP wajib diisi" })
    .min(4, { message: "Format slug tidak valid" })
    .max(80, { message: "Format slug tidak valid" })
    .regex(/^[a-z0-9-]+$/, {
      message: "Format slug tidak valid",
    }),
});

export const createRsvpLinkSchema = z.object({
  groomName: z.string().trim().min(1).max(100).optional().nullable(),
  brideName: z.string().trim().min(1).max(100).optional().nullable(),
  eventInfo: z
    .string()
    .trim()
    .max(1000, { message: "Detail acara maksimal 1000 karakter" })
    .optional()
    .nullable(),
});

export const updateRsvpLinkSchema = z
  .object({
    groomName: z.string().trim().min(1).max(100).optional().nullable(),
    brideName: z.string().trim().min(1).max(100).optional().nullable(),
    eventInfo: z
      .string()
      .trim()
      .max(1000, { message: "Detail acara maksimal 1000 karakter" })
      .optional()
      .nullable(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: "Minimal satu field harus diisi untuk memperbarui link RSVP",
  });

export const submitRsvpSchema = z.object({
  guestName: z
    .string({ message: "Nama tamu wajib diisi" })
    .trim()
    .min(2, { message: "Nama tamu minimal 2 karakter" })
    .max(100, { message: "Nama tamu maksimal 100 karakter" }),

  guestCount: z
    .number({ message: "Jumlah tamu wajib diisi" })
    .int({ message: "Jumlah tamu harus berupa bilangan bulat" })
    .min(1, { message: "Jumlah tamu minimal 1" })
    .max(20, {
      message:
        "Jumlah tamu maksimal 20. Untuk rombongan lebih besar, hubungi mempelai langsung",
    }),

  attendance: z.nativeEnum(RsvpAttendance, {
    message: "Status kehadiran harus ATTENDING atau NOT_ATTENDING",
  }),

  message: z
    .string()
    .trim()
    .max(500, { message: "Ucapan/doa maksimal 500 karakter" })
    .optional()
    .nullable()
    // String kosong disamakan dengan "tidak diisi" (null) — supaya query
    // "tampilkan ucapan tamu" di halaman publik tidak perlu filter tambahan
    // untuk membedakan null vs string kosong.
    .transform((val) => (val && val.length > 0 ? val : null)),
});

export type CreateRsvpLinkInput = z.infer<typeof createRsvpLinkSchema>;
export type UpdateRsvpLinkInput = z.infer<typeof updateRsvpLinkSchema>;
export type SubmitRsvpInput = z.infer<typeof submitRsvpSchema>;
