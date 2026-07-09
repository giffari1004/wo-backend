import { z } from "zod";
import { VendorCategory } from "@prisma/client";

// ============================================================================
// ORDER VENDOR VALIDATION SCHEMA
// ============================================================================

export const orderIdParamSchema = z.object({
  orderId: z.string().cuid({ message: "Format ID pesanan tidak valid" }),
});

export const orderVendorCategoryParamSchema = z.object({
  orderId: z.string().cuid({ message: "Format ID pesanan tidak valid" }),
  category: z.nativeEnum(VendorCategory, {
    message: "Kategori vendor tidak valid",
  }),
});

export const selectVendorSchema = z
  .object({
    orderId: z
      .string({ message: "Order ID wajib diisi" })
      .cuid({ message: "Format Order ID tidak valid" }),

    category: z.nativeEnum(VendorCategory, {
      message:
        "Kategori vendor tidak valid. Harus salah satu dari: VENUE, MUA, PHOTOGRAPHER, DECORATION, CATERING",
    }),

    vendorId: z
      .string({ message: "Vendor ID wajib diisi" })
      .cuid({ message: "Format Vendor ID tidak valid" }),

    cateringMenuId: z
      .string()
      .cuid({ message: "Format ID Menu Katering tidak valid" })
      .optional()
      .nullable(),
  })
  .refine(
    (data) =>
      data.category !== VendorCategory.CATERING || !!data.cateringMenuId,
    {
      message:
        "Paket menu katering wajib dipilih jika memilih vendor kategori CATERING",
      path: ["cateringMenuId"],
    },
  );

export type SelectVendorInput = z.infer<typeof selectVendorSchema>;
