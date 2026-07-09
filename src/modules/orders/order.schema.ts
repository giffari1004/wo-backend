import { z } from "zod";
import { OrderStatus } from "@prisma/client";

// ============================================================================
// ORDER VALIDATION SCHEMA
// ============================================================================

export const orderIdParamSchema = z.object({
  id: z.string().cuid({ message: "Format ID pesanan tidak valid" }),
});

export const createOrderDraftSchema = z.object({
  packageId: z
    .string({ message: "Package ID wajib disertakan" })
    .cuid({ message: "Format Package ID tidak valid" }),
});

export const updateOrderDraftSchema = z
  .object({
    weddingDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD")
      // Perbaikan Bug 3: UTC strict enforcement untuk menangkal pergeseran hari akibat local time server
      .transform((val) => new Date(val + "T00:00:00.000Z"))
      .optional(),

    guestCount: z
      .number()
      .int()
      .positive("Jumlah tamu harus bernilai positif")
      .optional(),
    specialNotes: z
      .string()
      .max(500, "Catatan khusus maksimal 500 karakter")
      .optional()
      .nullable(),

    venueId: z.string().cuid().optional().nullable(),
    muaId: z.string().cuid().optional().nullable(),
    photographerId: z.string().cuid().optional().nullable(),
    decorationId: z.string().cuid().optional().nullable(),
    cateringId: z.string().cuid().optional().nullable(),
    cateringMenuId: z.string().cuid().optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.weddingDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return data.weddingDate >= today;
      }
      return true;
    },
    {
      message: "Tanggal pernikahan tidak boleh di masa lalu",
      path: ["weddingDate"],
    },
  )
  .refine((data) => !data.cateringMenuId || !!data.cateringId, {
    // Perbaikan Isu 7: Cegah pengiriman paket menu tanpa mendeklarasikan ID katering
    message:
      "ID Vendor katering wajib disertakan jika Anda memilih paket menu katering",
    path: ["cateringId"],
  });

export const getOrdersQuerySchema = z.object({
  status: z
    .nativeEnum(OrderStatus, { message: "Status order tidak valid" })
    .optional(),
});

export type CreateOrderDraftInput = z.infer<typeof createOrderDraftSchema>;
export type UpdateOrderDraftInput = z.infer<typeof updateOrderDraftSchema>;
export type GetOrdersQueryInput = z.infer<typeof getOrdersQuerySchema>;
