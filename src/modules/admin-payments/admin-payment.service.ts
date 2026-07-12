import { prisma } from "../../config/database";
import { AppError } from "../../middlewares/error.middleware";
import { PaymentStatus, Prisma } from "@prisma/client";
import type { ListPaymentsQuery } from "./admin-payment.schema";

// ============================================================================
// ADMIN PAYMENT SERVICE
// ============================================================================
//
// 🔴 CATATAN DESAIN PENTING: aksi approve/reject pembayaran (verifikasi)
// SUDAH ADA di modul payments (`POST /payments/:paymentId/verify`,
// admin-only), begitu juga antrean WAITING_VERIFICATION
// (`GET /payments/admin/queue`). Modul ini SENGAJA TIDAK menduplikasi itu —
// single source of truth untuk mutasi payment tetap di payment.service.ts,
// supaya tidak ada dua tempat berbeda yang bisa saling tidak sinkron.
//
// Modul ini murni READ, melengkapi yang belum ada: ledger/riwayat pembayaran
// PENUH lintas semua status (bukan cuma antrean WAITING_VERIFICATION), dengan
// filter lebih kaya — buat admin yang butuh audit / cari pembayaran spesifik,
// beda kebutuhan dari antrean kerja harian.

/**
 * 1. Ledger — daftar seluruh pembayaran lintas order & status, dengan filter
 */
export async function listPayments(query: ListPaymentsQuery) {
  const { status, termType, orderId, search, dateFrom, dateTo, page, limit } =
    query;

  const where: Prisma.PaymentWhereInput = {
    deletedAt: null,
    ...(status && { status }),
    ...(termType && { termType }),
    ...(orderId && { orderId }),
    ...((dateFrom || dateTo) && {
      createdAt: {
        ...(dateFrom && { gte: dateFrom }),
        ...(dateTo && { lte: dateTo }),
      },
    }),
    ...(search && {
      order: {
        OR: [
          { orderNumber: { contains: search, mode: "insensitive" } },
          { user: { name: { contains: search, mode: "insensitive" } } },
          { user: { email: { contains: search, mode: "insensitive" } } },
        ],
      },
    }),
  };

  const [items, total, approvedSumAgg] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: {
        order: {
          select: {
            orderNumber: true,
            user: { select: { name: true, email: true } },
          },
        },
        bankAccount: true,
        verifiedBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.payment.count({ where }),
    // Total nominal yang BENAR-BENAR approved, mengikuti filter yang sama
    // (kecuali status — supaya angka ini tetap relevan berapa pun filter
    // status yang dipilih admin)
    prisma.payment.aggregate({
      where: { ...where, status: PaymentStatus.APPROVED },
      _sum: { amountDue: true },
    }),
  ]);

  return {
    items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    totalApprovedAmount: Number(approvedSumAgg._sum.amountDue ?? 0),
  };
}

/**
 * 2. Detail 1 pembayaran — termasuk info audit (siapa upload, siapa
 *    verifikasi) sesuai NFR Auditability di PRD, dan invoice terkait kalau
 *    sudah ter-generate
 */
export async function getPaymentDetail(paymentId: string) {
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, deletedAt: null },
    include: {
      order: {
        include: {
          user: { select: { name: true, email: true, phone: true } },
          package: { select: { name: true, tier: true } },
        },
      },
      bankAccount: true,
      uploadedBy: { select: { name: true, email: true } },
      verifiedBy: { select: { name: true, email: true } },
      invoice: true,
    },
  });

  if (!payment) {
    throw new AppError("Data pembayaran tidak ditemukan", 404);
  }

  return payment;
}
