import { prisma } from "../../config/database";
import { OrderStatus, PaymentStatus, RequestStatus } from "@prisma/client";
import type { DashboardQuery } from "./admin-dashboard.schema";

// ============================================================================
// ADMIN DASHBOARD SERVICE
// ============================================================================
//
// Modul ini READ-ONLY murni — hanya agregasi data dari modul lain (orders,
// payments, client-request, reschedule-request), tidak ada mutasi apa pun.
// Semua endpoint di sini admin-only, di-enforce di routes (bukan di sini).

// ── Pemetaan bucket revenue (PRD 4.2.1 & 5.6.1) ─────────────────────────────
// PRD minta revenue dipecah jadi 3 kategori ("pending payment, in progress,
// completed") tapi tidak merinci OrderStatus mana masuk kategori mana.
// Asumsi berikut didokumentasikan eksplisit supaya gampang dikoreksi:
// - pendingPayment → order sudah disubmit, DP belum lunas/belum diverifikasi
// - inProgress     → DP sudah confirmed, sedang berjalan sampai pelunasan
// - completed      → wedding sudah selesai dilaksanakan
// DRAFT (belum benar-benar order, masih form kosong) dan CANCELLED (batal)
// SENGAJA tidak dihitung sebagai revenue sama sekali di ketiga bucket ini —
// keduanya bukan komitmen finansial yang valid untuk dilaporkan sebagai uang.
const REVENUE_BUCKET_MAP: Partial<
  Record<OrderStatus, "pendingPayment" | "inProgress" | "completed">
> = {
  [OrderStatus.PENDING_PAYMENT]: "pendingPayment",
  [OrderStatus.DP_REVIEW]: "pendingPayment",
  [OrderStatus.IN_PREPARATION]: "inProgress",
  [OrderStatus.FULLY_PAID]: "inProgress",
  [OrderStatus.COMPLETED]: "completed",
};

// ── Pemetaan bucket jumlah order ────────────────────────────────────────────
// Rollup 3 kategori sesuai wording literal PRD ("pending, berlangsung,
// selesai"). DRAFT & CANCELLED masuk "other" — tetap dihitung supaya tidak
// hilang dari total keseluruhan, tapi dipisah dari funnel order yang aktif.
const ORDER_COUNT_BUCKET_MAP: Record<
  OrderStatus,
  "pending" | "ongoing" | "completed" | "other"
> = {
  [OrderStatus.DRAFT]: "other",
  [OrderStatus.PENDING_PAYMENT]: "pending",
  [OrderStatus.DP_REVIEW]: "pending",
  [OrderStatus.IN_PREPARATION]: "ongoing",
  [OrderStatus.FULLY_PAID]: "ongoing",
  [OrderStatus.COMPLETED]: "completed",
  [OrderStatus.CANCELLED]: "other",
};

/**
 * 1. Ringkasan revenue per kategori status (PRD 4.2.1 & 5.6.1)
 */
async function getRevenueSummary() {
  const grouped = await prisma.order.groupBy({
    by: ["status"],
    where: { deletedAt: null },
    _sum: { grandTotal: true },
  });

  const summary = { pendingPayment: 0, inProgress: 0, completed: 0 };

  for (const row of grouped) {
    const bucket = REVENUE_BUCKET_MAP[row.status];
    if (!bucket) continue; // DRAFT / CANCELLED sengaja diabaikan
    summary[bucket] += Number(row._sum.grandTotal ?? 0);
  }

  // 🆕 Bonus di luar permintaan literal PRD: uang yang BENAR-BENAR sudah
  // masuk (payment approved) — beda dari nilai kontrak di atas yang termasuk
  // bagian yang masih berupa piutang/janji bayar (belum tentu cair).
  const collectedAgg = await prisma.payment.aggregate({
    where: { status: PaymentStatus.APPROVED, deletedAt: null },
    _sum: { amountDue: true },
  });

  return {
    ...summary,
    totalContractValue:
      summary.pendingPayment + summary.inProgress + summary.completed,
    totalCollected: Number(collectedAgg._sum.amountDue ?? 0),
  };
}

/**
 * 2. Jumlah order per status (PRD 4.2.1 & 5.6.1)
 *    Return dua bentuk: rollup 3-kategori (sesuai wording PRD) DAN breakdown
 *    penuh per OrderStatus (lebih berguna buat admin/orders table filter).
 */
async function getOrderStats() {
  const grouped = await prisma.order.groupBy({
    by: ["status"],
    where: { deletedAt: null },
    _count: true,
  });

  const byStatus = Object.fromEntries(
    Object.values(OrderStatus).map((status) => [status, 0]),
  ) as Record<OrderStatus, number>;

  const summary = { pending: 0, ongoing: 0, completed: 0, other: 0 };

  for (const row of grouped) {
    byStatus[row.status] = row._count;
    summary[ORDER_COUNT_BUCKET_MAP[row.status]] += row._count;
  }

  const totalOrders = grouped.reduce((sum, row) => sum + row._count, 0);

  return { summary, byStatus, totalOrders };
}

/**
 * 3. Jadwal acara terdekat / upcoming weddings (PRD 4.2.1)
 */
async function getUpcomingWeddings(limit: number) {
  return prisma.order.findMany({
    where: {
      deletedAt: null,
      weddingDate: { gte: new Date() },
      // Hanya order yang acaranya benar-benar akan berlangsung — DRAFT
      // (tanggal belum fix) dan CANCELLED (batal) tidak relevan buat jadwal
      status: { in: [OrderStatus.IN_PREPARATION, OrderStatus.FULLY_PAID] },
    },
    select: {
      id: true,
      orderNumber: true,
      weddingDate: true,
      status: true,
      user: { select: { name: true, phone: true } },
      package: { select: { name: true, tier: true } },
    },
    orderBy: { weddingDate: "asc" },
    take: limit,
  });
}

/**
 * 4. Notifikasi aksi tertunda (PRD 4.2.1: "jumlah bukti transfer yang
 *    menunggu verifikasi atau request reschedule yang menunggu keputusan")
 *    🆕 clientRequestsPending ditambahkan di luar 2 contoh literal PRD —
 *    kategori "aksi tertunda" yang sama (request menunggu keputusan admin),
 *    infrastrukturnya sudah ada dari modul client-request.
 */
async function getPendingActions() {
  const [
    paymentsAwaitingVerification,
    rescheduleRequestsPending,
    clientRequestsPending,
  ] = await Promise.all([
    prisma.payment.count({
      where: { status: PaymentStatus.WAITING_VERIFICATION, deletedAt: null },
    }),
    prisma.rescheduleRequest.count({
      where: { status: RequestStatus.PENDING },
    }),
    prisma.clientRequest.count({
      where: { status: RequestStatus.PENDING },
    }),
  ]);

  return {
    paymentsAwaitingVerification,
    rescheduleRequestsPending,
    clientRequestsPending,
    total:
      paymentsAwaitingVerification +
      rescheduleRequestsPending +
      clientRequestsPending,
  };
}

/**
 * Endpoint utama — gabungkan semua ringkasan jadi satu payload untuk halaman
 * overview dashboard admin (PRD 4.2.1), supaya frontend cukup satu request.
 * Keempat query dijalankan paralel (Promise.all) karena saling independen.
 */
export async function getOverview(query: DashboardQuery) {
  const [revenue, orderStats, upcomingWeddings, pendingActions] =
    await Promise.all([
      getRevenueSummary(),
      getOrderStats(),
      getUpcomingWeddings(query.upcomingLimit),
      getPendingActions(),
    ]);

  return { revenue, orderStats, upcomingWeddings, pendingActions };
}
