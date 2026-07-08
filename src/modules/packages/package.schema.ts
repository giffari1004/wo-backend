import { z } from "zod";
import { PackageTier } from "@prisma/client";

// ============================================================================
// PACKAGE SCHEMA — Zod validation schemas untuk seluruh endpoint packages
// ============================================================================

// Schema untuk validasi req.params (ID paket harus berupa CUID valid)
export const packageIdParamSchema = z.object({
  id: z.string().cuid({ message: "Format ID paket tidak valid" }),
});

export const createPackageSchema = z.object({
  tier: z.nativeEnum(PackageTier, {
    message:
      "Tier paket tidak valid. Harus salah satu dari: SILVER, GOLD, PLATINUM",
  }),

  name: z
    .string({ message: "Nama paket wajib diisi" })
    .min(3, "Nama paket minimal 3 karakter")
    .max(50, "Nama paket maksimal 50 karakter")
    .trim(),

  description: z.string().optional().nullable(),

  basePrice: z
    .number({ message: "Harga dasar wajib diisi" })
    .positive("Harga dasar harus bernilai positif (> 0)"),

  guestCapacity: z
    .number({ message: "Kapasitas tamu wajib diisi" })
    .int("Kapasitas tamu harus berupa angka bulat")
    .positive("Kapasitas tamu harus bernilai positif"),

  thumbnailUrl: z
    .string()
    .url("Format URL thumbnail tidak valid")
    .or(z.literal(""))
    .transform((val) => (val === "" ? null : val)) // Mengubah otomatis "" menjadi null
    .nullable()
    .optional(),

  isActive: z.boolean().optional(),

  displayOrder: z.number().int().optional(),
});

export const updatePackageSchema = createPackageSchema.partial();

export type CreatePackageInput = z.infer<typeof createPackageSchema>;
export type UpdatePackageInput = z.infer<typeof updatePackageSchema>;
export type PackageIdParamInput = z.infer<typeof packageIdParamSchema>;
