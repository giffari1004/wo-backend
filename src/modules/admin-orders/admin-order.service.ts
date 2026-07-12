import { prisma } from "../../config/database";
import { AppError } from "../../middlewares/error.middleware";
import * as notificationService from "../notifications/notification.service";
import { Order, OrderStatus, NotificationType, Prisma } from "@prisma/client";
import type { ListOrdersQuery, CancelOrderInput } from "./admin-order.schema";

// ============================================================================
// ADMIN ORDER SERVICE
// ============================================================================
//
// 🔴 CATATAN DESAIN: modul ini SENGAJA tidak menduplikasi mutasi checklist
// preparation (PATCH /preparation/:taskId sudah ada, admin-only, lengkap
// dengan notifikasi PREPARATION_UPDATE) — di sini preparationTasks cuma
// diikutsertakan sebagai READ dalam getOrderDetail, untuk ditampilkan di
// halaman detail order admin. Mutasinya tetap lewat modul preparation.

// Order yang statusnya sudah final — tidak masuk akal dibatalkan lagi
const NON_CANCELLABLE_STATUSES: OrderStatus[] = [
  OrderStatus.COMPLETED,
  OrderStatus.CANCELLED,
];

/**
 * 1. Daftar seluruh order — filter status, pencarian, rentang tanggal wedding,
 *    pagination (PRD 4.2.6: admin butuh lihat & kelola banyak order terpusat)
 */
export async function listOrders(query: ListOrdersQuery) {
  const { status, search, weddingDateFrom, weddingDateTo, page, limit } = query;

  const where: Prisma.OrderWhereInput = {
    deletedAt: null,
    ...(status && { status }),
    ...((weddingDateFrom || weddingDateTo) && {
      weddingDate: {
        ...(weddingDateFrom && { gte: weddingDateFrom }),
        ...(weddingDateTo && { lte: weddingDateTo }),
      },
    }),
    ...(search && {
      OR: [
        { orderNumber: { contains: search, mode: "insensitive" } },
        { user: { name: { contains: search, mode: "insensitive" } } },
        { user: { email: { contains: search, mode: "insensitive" } } },
      ],
    }),
  };

  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        user: { select: { name: true, email: true, phone: true } },
        package: { select: { name: true, tier: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.order.count({ where }),
  ]);

  return {
    items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

/**
 * 2. Detail lengkap satu order — gabungan data dari SEMUA modul terkait
 *    (PRD 4.2.6: "vendor terpilih, riwayat pembayaran, catatan client")
 */
export async function getOrderDetail(orderId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, deletedAt: null },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      package: true,
      orderVendors: {
        include: { vendor: true, cateringMenu: true },
        orderBy: { category: "asc" },
      },
      payments: {
        include: { bankAccount: true },
        orderBy: { createdAt: "asc" },
      },
      invoices: { orderBy: { issuedAt: "desc" } },
      preparationTasks: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
      clientRequests: { orderBy: { createdAt: "desc" } },
      rescheduleRequests: { orderBy: { createdAt: "desc" } },
      rsvpLink: true,
    },
  });

  if (!order) {
    throw new AppError("Pesanan tidak ditemukan", 404);
  }

  return order;
}

/**
 * 3. Batalkan order — melepas semua blok VendorAvailability terkait
 *    (supaya vendor kembali available untuk client lain) + notifikasi client
 */
export async function cancelOrder(
  orderId: string,
  input: CancelOrderInput,
): Promise<Order> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, deletedAt: null },
  });
  if (!order) {
    throw new AppError("Pesanan tidak ditemukan", 404);
  }
  if (NON_CANCELLABLE_STATUSES.includes(order.status)) {
    throw new AppError(
      `Pesanan berstatus ${order.status} tidak dapat dibatalkan`,
      400,
    );
  }

  return prisma.$transaction(async (tx) => {
    // Lepas semua blok tanggal vendor yang terpasang untuk order ini —
    // supaya vendor kembali available untuk client lain begitu order batal
    await tx.vendorAvailability.deleteMany({ where: { orderId } });

    const updated = await tx.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.CANCELLED },
    });

    // ⚠️ CATATAN SCHEMA: `input.reason` TIDAK tersimpan secara terstruktur —
    // model Order tidak punya kolom `cancelReason`/`cancelledById`/
    // `cancelledAt` di schema.prisma saat ini. Untuk sekarang, alasan hanya
    // tercatat di pesan notifikasi (dan log server) — tidak bisa di-query
    // ulang dari tabel Order nanti. Kalau butuh audit trail permanen yang
    // bisa dicari/dilaporkan, perlu migration nambah kolom di Order dulu.
    await notificationService.createNotification(tx, {
      userId: order.userId,
      orderId: order.id,
      type: NotificationType.GENERAL,
      title: "Pesanan Dibatalkan",
      message: `Pesanan ${order.orderNumber} telah dibatalkan oleh admin. Alasan: ${input.reason}`,
    });

    return updated;
  });
}
