import { z } from "zod";
import { VendorCategory } from "@prisma/client";

// ============================================================================
// ADMIN REPORT VALIDATION SCHEMA
// ============================================================================

export const revenueReportQuerySchema = z
  .object({
    dateFrom: z.coerce.date({ message: "Tanggal awal wajib diisi" }),
    dateTo: z.coerce.date({ message: "Tanggal akhir wajib diisi" }),
    groupBy: z.enum(["day", "month"]).default("month"),
  })
  .refine((data) => data.dateFrom.getTime() <= data.dateTo.getTime(), {
    message: "Tanggal awal harus sebelum atau sama dengan tanggal akhir",
    path: ["dateFrom"],
  });

export const vendorPerformanceQuerySchema = z
  .object({
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    category: z
      .nativeEnum(VendorCategory, { message: "Kategori vendor tidak valid" })
      .optional(),
  })
  .refine(
    (data) =>
      !data.dateFrom ||
      !data.dateTo ||
      data.dateFrom.getTime() <= data.dateTo.getTime(),
    {
      message: "Tanggal awal harus sebelum atau sama dengan tanggal akhir",
      path: ["dateFrom"],
    },
  );

export type RevenueReportQuery = z.infer<typeof revenueReportQuerySchema>;
export type VendorPerformanceQuery = z.infer<
  typeof vendorPerformanceQuerySchema
>;
