import { z } from "zod";

// ============================================================================
// ADMIN DASHBOARD VALIDATION SCHEMA
// ============================================================================

export const dashboardQuerySchema = z.object({
  // Berapa banyak jadwal acara terdekat yang ditampilkan di overview.
  // Default 10 — cukup untuk kartu ringkasan, admin bisa lihat daftar penuh
  // lewat modul admin/calendar kalau butuh lebih.
  upcomingLimit: z.coerce.number().int().min(1).max(50).default(10),
});

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;
