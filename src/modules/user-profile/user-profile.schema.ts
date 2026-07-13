import { z } from "zod";

// ============================================================================
// USER PROFILE VALIDATION SCHEMA
// ============================================================================
//
// ⚠️ Regex nomor HP di bawah ini ditulis independen — kalau modul `auth`
// sudah punya validasi nomor HP sendiri di register schema-nya, PASTIKAN
// pattern-nya SAMA PERSIS. Kalau beda (lebih ketat di sini), user yang
// nomornya valid saat daftar bisa tiba-tiba ditolak saat coba update profil
// dengan nomor yang sama.

export const updateProfileSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, { message: "Nama minimal 2 karakter" })
      .max(100, { message: "Nama maksimal 100 karakter" })
      .optional(),

    phone: z
      .string()
      .trim()
      .regex(/^(\+62|62|0)8[1-9][0-9]{6,10}$/, {
        message: "Format nomor HP Indonesia tidak valid",
      })
      .optional(),

    // Cuma terima URL string — proses upload file avatar itu sendiri
    // TIDAK ditangani di modul ini, tapi lewat modul `upload` (shared
    // handler). Alurnya: client upload file dulu ke /upload, dapat URL,
    // baru PATCH ke sini dengan URL tersebut.
    avatarUrl: z
      .string()
      .url({ message: "Format URL avatar tidak valid" })
      .optional()
      .nullable(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: "Minimal satu field harus diisi untuk memperbarui profil",
  });

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
