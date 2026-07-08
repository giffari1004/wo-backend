import { z } from "zod";

// ============================================================================
// CATERING MENU SCHEMA
// ============================================================================

export const cateringMenuIdParamSchema = z.object({
  id: z.string().cuid({ message: "Format ID menu katering tidak valid" }),
});

export const vendorIdParamSchema = z.object({
  vendorId: z.string().cuid({ message: "Format ID vendor tidak valid" }),
});

export const createCateringMenuSchema = z.object({
  vendorId: z
    .string({ message: "Vendor ID wajib disertakan" })
    .cuid({ message: "Format Vendor ID tidak valid" }),

  name: z
    .string({ message: "Nama menu katering wajib diisi" })
    .min(3, "Nama menu minimal 3 karakter")
    .max(100, "Nama menu maksimal 100 karakter")
    .trim(),

  description: z.string().optional().nullable(),

  pricePerPax: z
    .number({ message: "Harga per pax wajib diisi" })
    .positive("Harga per pax harus bernilai positif (> 0)"),

  menuItems: z
    .array(z.string().min(2, "Nama item hidangan tidak boleh kosong"))
    .min(1, "Minimal harus ada 1 item hidangan makanan di dalam menu katering"),

  isActive: z.boolean().optional(),
});

// Perbaikan Isu 5: Menambahkan .refine() untuk mencegah array kosong [] lolos saat update
export const updateCateringMenuSchema = createCateringMenuSchema
  .omit({ vendorId: true })
  .partial()
  .refine(
    (data) => data.menuItems === undefined || data.menuItems.length >= 1,
    {
      message:
        "Jika item hidangan makanan diubah, minimal harus menyertakan 1 item hidangan",
      path: ["menuItems"],
    },
  );

export type CreateCateringMenuInput = z.infer<typeof createCateringMenuSchema>;
export type UpdateCateringMenuInput = z.infer<typeof updateCateringMenuSchema>;
