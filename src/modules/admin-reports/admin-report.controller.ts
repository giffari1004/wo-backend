import { Request, Response, NextFunction } from "express";
import * as adminReportService from "./admin-report.service";
import { sendSuccess } from "../../middlewares/error.middleware";
import type {
  RevenueReportQuery,
  VendorPerformanceQuery,
} from "./admin-report.schema";

// ============================================================================
// ADMIN REPORT CONTROLLER (STRICT GENERIC TYPING)
// ============================================================================

export async function getRevenueReport(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // Cast manual — ParsedQs bawaan Express tidak kompatibel dengan tipe
    // hasil coercion Zod (dateFrom/dateTo: Date)
    const query = req.query as unknown as RevenueReportQuery;
    const result = await adminReportService.getRevenueReport(query);
    sendSuccess(res, result, "Laporan revenue berhasil diambil");
  } catch (err) {
    next(err);
  }
}

export async function getVendorPerformanceReport(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const query = req.query as unknown as VendorPerformanceQuery;
    const result = await adminReportService.getVendorPerformanceReport(query);
    sendSuccess(res, result, "Laporan performa vendor berhasil diambil");
  } catch (err) {
    next(err);
  }
}

export async function exportRevenueReportPdf(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const query = req.query as unknown as RevenueReportQuery;
    const pdfBuffer = await adminReportService.exportRevenueReportPdf(query);

    const fromStr = query.dateFrom.toISOString().slice(0, 10);
    const toStr = query.dateTo.toISOString().slice(0, 10);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="laporan-revenue-${fromStr}-${toStr}.pdf"`,
    );
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
}

export async function exportVendorPerformancePdf(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const query = req.query as unknown as VendorPerformanceQuery;
    const pdfBuffer =
      await adminReportService.exportVendorPerformancePdf(query);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="laporan-performa-vendor.pdf"`,
    );
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
}
