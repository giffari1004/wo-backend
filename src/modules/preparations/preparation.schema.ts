import { z } from "zod";
import { PreparationStatus } from "@prisma/client";

// ============================================================================
// PREPARATION VALIDATION SCHEMA
// ============================================================================

export const orderIdParamSchema = z.object({
  orderId: z.string().cuid({ message: "Format ID Pesanan tidak valid" }),
});

export const taskIdParamSchema = z.object({
  taskId: z.string().cuid({ message: "Format ID Tugas persiapan tidak valid" }),
});

export const createTaskSchema = z.object({
  title: z
    .string({ message: "Judul tugas wajib diisi" })
    .trim()
    .min(3, { message: "Judul tugas minimal 3 karakter" })
    .max(150, { message: "Judul tugas maksimal 150 karakter" }),

  description: z
    .string()
    .trim()
    .max(1000, { message: "Deskripsi maksimal 1000 karakter" })
    .optional()
    .nullable(),

  dueDate: z
    .string()
    .optional()
    .nullable()
    .transform((val) => (val ? new Date(val) : null))
    .refine((date) => date === null || !isNaN(date.getTime()), {
      message: "Format tanggal tenggat tidak valid",
    }),

  // Opsional — kalau tidak diisi, task otomatis ditaruh di urutan paling akhir
  sortOrder: z.number().int().min(0).optional(),
});

export const updateTaskSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, { message: "Judul tugas minimal 3 karakter" })
      .max(150, { message: "Judul tugas maksimal 150 karakter" })
      .optional(),

    description: z
      .string()
      .trim()
      .max(1000, { message: "Deskripsi maksimal 1000 karakter" })
      .optional()
      .nullable(),

    status: z
      .nativeEnum(PreparationStatus, {
        message:
          "Status tugas tidak valid. Harus PENDING, IN_PROGRESS, atau DONE",
      })
      .optional(),

    dueDate: z
      .union([z.string(), z.null()])
      .optional()
      .transform((val) => {
        if (val === undefined) return undefined;
        if (val === null) return null;
        return new Date(val);
      })
      .refine(
        (val) => val === undefined || val === null || !isNaN(val.getTime()),
        { message: "Format tanggal tenggat tidak valid" },
      ),

    sortOrder: z.number().int().min(0).optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: "Minimal satu field harus diisi untuk memperbarui tugas",
  });

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
