import { z } from "zod";

// ============================================================================
// ADMIN CALENDAR VALIDATION SCHEMA
// ============================================================================

export const calendarQuerySchema = z.object({
  // Format YYYY-MM, contoh: "2026-07"
  month: z
    .string({ message: "Parameter bulan wajib diisi" })
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, {
      message: "Format bulan harus YYYY-MM, contoh: 2026-07",
    }),
});

export const dayParamSchema = z.object({
  // Format YYYY-MM-DD
  date: z
    .string({ message: "Parameter tanggal wajib diisi" })
    .regex(/^\d{4}-\d{2}-\d{2}$/, {
      message: "Format tanggal harus YYYY-MM-DD, contoh: 2026-07-15",
    }),
});

export const conflictsQuerySchema = z.object({
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export type CalendarQuery = z.infer<typeof calendarQuerySchema>;
export type DayParam = z.infer<typeof dayParamSchema>;
export type ConflictsQuery = z.infer<typeof conflictsQuerySchema>;
