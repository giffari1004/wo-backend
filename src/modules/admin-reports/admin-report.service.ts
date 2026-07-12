import { prisma } from "../../config/database";
import {
  generatePdfFromHtml,
  buildRevenueReportHtml,
  buildVendorPerformanceReportHtml,
} from "../../utils/pdf";
import { OrderStatus, PaymentStatus, PaymentTermType } from "@prisma/client";
import type {
  RevenueReportQuery,
  VendorPerformanceQuery,
} from "./admin-report.schema";

// ============================================================================
// ADMIN REPORT SERVICE
// ============================================================================
//
// ⚠️ CATATAN SCOPE: PRD bagian 7 ("Di Luar Lingkup MVP") mencantumkan modul
// ini sebagai FASE 2 ("Laporan/report revenue dan performa vendor yang dapat
// diekspor Excel/PDF") — bukan MVP resmi. Export Excel BELUM diimplementasi
// (butuh dependency baru, exceljs, yang belum ada di stack) — baru cakupan
// JSON + export PDF yang dibangun sekarang (Puppeteer sudah ada dari modul
// invoices, tidak perlu dependency tambahan).

function periodKey(date: Date, groupBy: "day" | "month"): string {
  const iso = date.toISOString();
  return groupBy === "day" ? iso.slice(0, 10) : iso.slice(0, 7);
}

interface RevenueTimelineBucket {
  period: string;
  totalRevenue: number;
  dpRevenue: number;
  finalRevenue: number;
  paymentCount: number;
}

interface VendorPerformanceEntry {
  vendorId: string;
  vendorName: string;
  category: string;
  bookingCount: number;
  totalRevenueGenerated: number;
  ratingAvg: number;
  ratingCount: number;
}

/**
 * 1. Laporan revenue — time series berdasarkan pembayaran yang BENAR-BENAR
 *    approved (`Payment.verifiedAt`, uang riil sudah masuk), BUKAN dari
 *    nilai kontrak/piutang seperti di admin-dashboard. Dikelompokkan per
 *    hari atau per bulan sesuai `groupBy`.
 */
export async function getRevenueReport(query: RevenueReportQuery) {
  const { dateFrom, dateTo, groupBy } = query;

  const payments = await prisma.payment.findMany({
    where: {
      status: PaymentStatus.APPROVED,
      deletedAt: null,
      verifiedAt: { gte: dateFrom, lte: dateTo },
    },
    select: { amountDue: true, termType: true, verifiedAt: true },
  });

  const buckets = new Map<string, RevenueTimelineBucket>();

  for (const payment of payments) {
    // payment.verifiedAt dijamin terisi secara bisnis untuk status APPROVED
    // (payment.service.ts selalu set verifiedAt bersamaan dengan status)
    const key = periodKey(payment.verifiedAt!, groupBy);
    if (!buckets.has(key)) {
      buckets.set(key, {
        period: key,
        totalRevenue: 0,
        dpRevenue: 0,
        finalRevenue: 0,
        paymentCount: 0,
      });
    }
    const bucket = buckets.get(key)!;
    const amount = Number(payment.amountDue);
    bucket.totalRevenue += amount;
    bucket.paymentCount += 1;
    if (payment.termType === PaymentTermType.DOWN_PAYMENT) {
      bucket.dpRevenue += amount;
    } else {
      bucket.finalRevenue += amount;
    }
  }

  const timeline = Array.from(buckets.values()).sort((a, b) =>
    a.period.localeCompare(b.period),
  );
  const grandTotal = timeline.reduce(
    (sum, bucket) => sum + bucket.totalRevenue,
    0,
  );

  return { dateFrom, dateTo, groupBy, timeline, grandTotal };
}

/**
 * 2. Laporan performa vendor — jumlah booking & revenue upgrade/catering
 *    (BUKAN termasuk yang gratis/default bawaan paket — lihat catatan di
 *    template PDF), plus rating dari Vendor.ratingAvg/ratingCount
 *    (denormalized field yang sudah ada, dikelola modul vendor-review).
 */
export async function getVendorPerformanceReport(
  query: VendorPerformanceQuery,
) {
  const { dateFrom, dateTo, category } = query;

  const orderVendors = await prisma.orderVendor.findMany({
    where: {
      order: {
        deletedAt: null,
        status: { notIn: [OrderStatus.DRAFT, OrderStatus.CANCELLED] },
        ...((dateFrom || dateTo) && {
          weddingDate: {
            ...(dateFrom && { gte: dateFrom }),
            ...(dateTo && { lte: dateTo }),
          },
        }),
      },
      ...(category && { vendor: { category } }),
    },
    select: {
      vendorId: true,
      priceAtBooking: true,
      vendor: {
        select: {
          name: true,
          category: true,
          ratingAvg: true,
          ratingCount: true,
        },
      },
    },
  });

  const grouped = new Map<string, VendorPerformanceEntry>();

  for (const ov of orderVendors) {
    if (!grouped.has(ov.vendorId)) {
      grouped.set(ov.vendorId, {
        vendorId: ov.vendorId,
        vendorName: ov.vendor.name,
        category: ov.vendor.category,
        bookingCount: 0,
        totalRevenueGenerated: 0,
        ratingAvg: Number(ov.vendor.ratingAvg),
        ratingCount: ov.vendor.ratingCount,
      });
    }
    const entry = grouped.get(ov.vendorId)!;
    entry.bookingCount += 1;
    entry.totalRevenueGenerated += Number(ov.priceAtBooking);
  }

  const vendors = Array.from(grouped.values()).sort(
    (a, b) => b.bookingCount - a.bookingCount,
  );

  return {
    dateFrom: dateFrom ?? null,
    dateTo: dateTo ?? null,
    category: category ?? null,
    vendors,
  };
}

/**
 * 3. Export PDF laporan revenue
 */
export async function exportRevenueReportPdf(
  query: RevenueReportQuery,
): Promise<Buffer> {
  const report = await getRevenueReport(query);
  const html = buildRevenueReportHtml(report);
  return generatePdfFromHtml(html);
}

/**
 * 4. Export PDF laporan performa vendor
 */
export async function exportVendorPerformancePdf(
  query: VendorPerformanceQuery,
): Promise<Buffer> {
  const report = await getVendorPerformanceReport(query);
  const html = buildVendorPerformanceReportHtml(report);
  return generatePdfFromHtml(html);
}
