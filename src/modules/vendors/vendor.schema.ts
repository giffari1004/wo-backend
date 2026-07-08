import { z } from "zod";
import { VendorCategory } from "@prisma/client";

// ============================================================================
// VENDOR SCHEMA — Validasi input terpusat untuk modul Vendor
// ============================================================================

export const vendorIdParamSchema = z.object({
  id: z.string().cuid({ message: "Format ID vendor tidak valid" }),
});

export const portfolioIdParamSchema = z.object({
  portfolioId: z.string().cuid({ message: "Format ID portfolio tidak valid" }),
});

// Schema validasi query parameter (?category=...)
export const getVendorsQuerySchema = z.object({
  category: z
    .nativeEnum(VendorCategory, {
      message:
        "Kategori filter tidak valid. Harus salah satu dari: VENUE, MUA, PHOTOGRAPHER, DECORATION, CATERING",
    })
    .optional(),
});

export const createVendorSchema = z.object({
  category: z.nativeEnum(VendorCategory, {
    message:
      "Kategori tidak valid. Harus salah satu dari: VENUE, MUA, PHOTOGRAPHER, DECORATION, CATERING",
  }),

  name: z
    .string({ message: "Nama vendor wajib diisi" })
    .min(3, "Nama vendor minimal 3 karakter")
    .max(100, "Nama vendor maksimal 100 karakter")
    .trim(),

  description: z.string().optional().nullable(),

  basePrice: z
    .number({ message: "Harga dasar wajib diisi" })
    .min(0, "Harga dasar tidak boleh bernilai negatif"),

  upgradeFee: z.number().optional().default(0),

  location: z.string().optional().nullable(),

  capacity: z
    .number()
    .int("Kapasitas harus berupa angka bulat")
    .positive("Kapasitas harus bernilai positif")
    .optional()
    .nullable(),

  facilities: z.array(z.string()).optional().default([]),

  thumbnailUrl: z
    .string()
    .url("Format URL thumbnail tidak valid")
    .or(z.literal(""))
    .transform((val) => (val === "" ? null : val))
    .nullable()
    .optional(),

  isActive: z.boolean().optional(),
});

export const updateVendorSchema = createVendorSchema.partial();

export const addPortfolioSchema = z.object({
  mediaUrl: z
    .string({ message: "URL media portfolio wajib diisi" })
    .url("Format URL media tidak valid"),
  mediaType: z.enum(["image", "video"]).optional().default("image"),
  caption: z
    .string()
    .max(200, "Keterangan foto maksimal 200 karakter")
    .optional()
    .nullable(),
});

export const setAvailabilitySchema = z
  .object({
    date: z
      .string({ message: "Tanggal wajib diisi" })
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD")
      .transform((val) => {
        const d = new Date(val);
        d.setHours(0, 0, 0, 0); // Reset waktu untuk perbandingan tanggal murni
        return d;
      }),
    isBlocked: z.boolean({
      message: "Status blokir wajib ditentukan (true/false)",
    }),
    reason: z
      .string()
      .max(100, "Alasan pemblokiran maksimal 100 karakter")
      .optional()
      .nullable(),
  })
  .refine(
    (data) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return data.date >= today; // Proteksi tanggal masa lalu
    },
    {
      message:
        "Tidak dapat mengonfigurasi ketersediaan pada tanggal di masa lalu",
      path: ["date"],
    },
  );

export type CreateVendorInput = z.infer<typeof createVendorSchema>;
export type UpdateVendorInput = z.infer<typeof updateVendorSchema>;
export type AddPortfolioInput = z.infer<typeof addPortfolioSchema>;
export type SetAvailabilityInput = z.infer<typeof setAvailabilitySchema>;
