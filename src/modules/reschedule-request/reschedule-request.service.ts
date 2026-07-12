import { prisma } from "@/config/database";
import { AppError } from "@/middlewares/error.middleware";
import { withSerializableRetry } from "@/utils/prisma-retry";
import * as notificationService from "../notifications/notification.service";
import {
  RequestStatus,
  OrderStatus,
  NotificationType,
  Prisma,
} from "@prisma/client";
import type {
  CreateRescheduleRequestInput,
  ApproveRescheduleRequestInput,
  RejectRescheduleRequestInput,
  ListRescheduleRequestQuery,
} from "./reschedule-request.schema";

// Status order yang boleh diajukan reschedule: sudah disubmit, belum selesai/batal
const RESCHEDULABLE_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING_PAYMENT,
  OrderStatus.DP_REVIEW,
  OrderStatus.IN_PREPARATION,
  OrderStatus.FULLY_PAID,
];

/**
 * Normalisasi Date ke date-only (00:00:00 UTC) supaya cocok dengan
 * kolom @db.Date di VendorAvailability/Order (yang tidak menyimpan komponen jam).
 */
function toDateOnly(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

async function assertOrderOwnership(orderId: string, userId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, deletedAt: null },
  });

  if (!order) {
    throw new AppError("Order tidak ditemukan", 404);
  }

  if (order.userId !== userId) {
    throw new AppError("Anda tidak memiliki akses ke order ini", 403);
  }

  return order;
}

/**
 * Cek availability seluruh vendor (termasuk gedung, karena gedung juga
 * disimpan sebagai OrderVendor dengan category VENUE) yang terpasang
 * di order ini, pada tanggal baru yang diajukan.
 *
 * Blok yang berasal dari order ini sendiri diabaikan (bukan bentrok,
 * karena blok tersebut akan dipindah saat approve, bukan dianggap konflik).
 */
async function findVendorConflicts(
  tx: Prisma.TransactionClient | typeof prisma,
  orderId: string,
  requestedDate: Date,
) {
  const orderVendors = await tx.orderVendor.findMany({
    where: { orderId },
    include: { vendor: { select: { id: true, name: true, category: true } } },
  });

  const vendorIds = orderVendors.map((ov) => ov.vendorId);
  if (vendorIds.length === 0) return [];

  const blocks = await tx.vendorAvailability.findMany({
    where: {
      vendorId: { in: vendorIds },
      date: toDateOnly(requestedDate),
      isBlocked: true,
      NOT: { orderId },
    },
  });

  const blockedVendorIds = new Set(blocks.map((b) => b.vendorId));

  return orderVendors
    .filter((ov) => blockedVendorIds.has(ov.vendorId))
    .map((ov) => ({
      vendorId: ov.vendorId,
      name: ov.vendor.name,
      category: ov.vendor.category,
    }));
}

export const rescheduleRequestService = {
  async create(
    orderId: string,
    userId: string,
    input: CreateRescheduleRequestInput,
  ) {
    const order = await assertOrderOwnership(orderId, userId);

    if (!order.weddingDate) {
      throw new AppError(
        "Order ini belum memiliki tanggal pernikahan untuk di-reschedule",
        400,
      );
    }

    if (!RESCHEDULABLE_STATUSES.includes(order.status)) {
      throw new AppError(
        `Order dengan status '${order.status}' tidak dapat diajukan reschedule`,
        400,
      );
    }

    const normalizedRequestedDate = toDateOnly(input.requestedDate);

    // 🔴 FIX: cegah client "reschedule" ke tanggal yang sama persis dengan
    // tanggal saat ini — sebelumnya tidak dicek sama sekali
    if (normalizedRequestedDate.getTime() === order.weddingDate.getTime()) {
      throw new AppError(
        "Tanggal baru harus berbeda dari tanggal pernikahan saat ini",
        400,
      );
    }

    const pendingExists = await prisma.rescheduleRequest.findFirst({
      where: { orderId, status: RequestStatus.PENDING },
    });

    if (pendingExists) {
      throw new AppError(
        "Sudah ada pengajuan reschedule yang masih menunggu keputusan admin",
        409,
      );
    }

    // 🔴 FIX: cek konflik vendor SEJAK client submit request — sebelumnya
    // semua pengecekan ditunda sampai admin manual cek (previewConflicts)
    // atau approve, jadi client bisa saja mengajukan tanggal yang sudah
    // pasti gagal tanpa tahu dari awal. Ini beri feedback instan.
    const conflicts = await findVendorConflicts(
      prisma,
      orderId,
      normalizedRequestedDate,
    );
    if (conflicts.length > 0) {
      const names = conflicts
        .map((c) => `${c.name} (${c.category})`)
        .join(", ");
      throw new AppError(
        `Tanggal ini sudah terisi untuk vendor berikut: ${names}. Silakan pilih tanggal lain.`,
        409,
      );
    }

    return prisma.rescheduleRequest.create({
      data: {
        orderId,
        userId,
        currentDate: order.weddingDate,
        requestedDate: normalizedRequestedDate,
        reason: input.reason ?? null,
      },
    });
  },

  async listByOrder(orderId: string, userId: string) {
    await assertOrderOwnership(orderId, userId);

    return prisma.rescheduleRequest.findMany({
      where: { orderId },
      orderBy: { createdAt: "desc" },
    });
  },

  async listAllForAdmin(query: ListRescheduleRequestQuery) {
    const { status, orderId, page, limit } = query;
    const where = {
      ...(status && { status: status as RequestStatus }),
      ...(orderId && { orderId }),
    };

    const [items, total] = await Promise.all([
      prisma.rescheduleRequest.findMany({
        where,
        include: {
          order: { select: { orderNumber: true } },
          user: { select: { name: true, email: true, phone: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.rescheduleRequest.count({ where }),
    ]);

    return {
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  async getById(id: string) {
    const request = await prisma.rescheduleRequest.findUnique({
      where: { id },
      include: {
        order: {
          select: { orderNumber: true, weddingDate: true, status: true },
        },
        user: { select: { name: true, email: true, phone: true } },
      },
    });

    if (!request) {
      throw new AppError("Reschedule request tidak ditemukan", 404);
    }

    return request;
  },

  /**
   * Preview konflik untuk sebuah reschedule request tanpa melakukan approve.
   * Dipakai admin sebelum memutuskan approve/reject.
   */
  async previewConflicts(id: string) {
    const request = await this.getById(id);
    const conflicts = await findVendorConflicts(
      prisma,
      request.orderId,
      request.requestedDate,
    );
    return { request, conflicts, hasConflict: conflicts.length > 0 };
  },

  /**
   * Approve reschedule request.
   *
   * Isolation level dinaikkan ke Serializable — mengikuti pola yang sama
   * dengan order-vendor.service.ts (selectVendor) — karena operasi ini
   * membaca lalu menulis VendorAvailability, rawan race condition kalau
   * dua reschedule/booking diproses bersamaan untuk vendor yang sama.
   */
  async approve(id: string, input: ApproveRescheduleRequestInput) {
    return withSerializableRetry(() =>
      prisma.$transaction(
        async (tx) => {
          const request = await tx.rescheduleRequest.findUnique({
            where: { id },
            include: { order: { select: { orderNumber: true } } },
          });

          if (!request) {
            throw new AppError("Reschedule request tidak ditemukan", 404);
          }

          if (request.status !== RequestStatus.PENDING) {
            throw new AppError(
              "Reschedule request ini sudah diproses sebelumnya",
              409,
            );
          }

          const conflicts = await findVendorConflicts(
            tx,
            request.orderId,
            request.requestedDate,
          );

          if (conflicts.length > 0) {
            const names = conflicts
              .map((c) => `${c.name} (${c.category})`)
              .join(", ");
            throw new AppError(
              `Tidak dapat menyetujui reschedule: vendor berikut sudah terpakai pada tanggal baru — ${names}`,
              409,
            );
          }

          const orderVendors = await tx.orderVendor.findMany({
            where: { orderId: request.orderId },
            select: { vendorId: true },
          });

          // Lepas blok availability lama di tanggal sebelumnya untuk order ini
          await tx.vendorAvailability.deleteMany({
            where: { orderId: request.orderId },
          });

          // Pasang blok baru per-vendor pakai upsert (bukan createMany+skipDuplicates)
          // supaya tidak diam-diam gagal insert kalau ada row stale di vendorId+date yang sama —
          // pola ini mengikuti submitOrder() di order.service.ts.
          for (const ov of orderVendors) {
            await tx.vendorAvailability.upsert({
              where: {
                vendorId_date: {
                  vendorId: ov.vendorId,
                  date: request.requestedDate,
                },
              },
              update: {
                isBlocked: true,
                reason: `Reschedule disetujui untuk Order ${request.orderId}`,
                orderId: request.orderId,
              },
              create: {
                vendorId: ov.vendorId,
                date: request.requestedDate,
                isBlocked: true,
                reason: `Reschedule disetujui untuk Order ${request.orderId}`,
                orderId: request.orderId,
              },
            });
          }

          await tx.order.update({
            where: { id: request.orderId },
            data: { weddingDate: request.requestedDate },
          });

          const updated = await tx.rescheduleRequest.update({
            where: { id },
            data: {
              status: RequestStatus.APPROVED,
              adminNote: input.adminNote ?? null,
              processedAt: new Date(),
            },
          });

          // 🔴 FIX: kirim notifikasi RESCHEDULE_UPDATE ke client — sebelumnya
          // tidak ada sama sekali, client tidak akan tahu reschedule-nya disetujui
          await notificationService.createNotification(tx, {
            userId: request.userId,
            orderId: request.orderId,
            type: NotificationType.RESCHEDULE_UPDATE,
            title: "Permintaan Reschedule Disetujui",
            message: `Tanggal pernikahan untuk pesanan ${request.order.orderNumber} telah diperbarui ke ${request.requestedDate.toLocaleDateString("id-ID")}.`,
          });

          return updated;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5000,
          timeout: 10000,
        },
      ),
    );
  },

  async reject(id: string, input: RejectRescheduleRequestInput) {
    const request = await prisma.rescheduleRequest.findUnique({
      where: { id },
      include: { order: { select: { orderNumber: true } } },
    });

    if (!request) {
      throw new AppError("Reschedule request tidak ditemukan", 404);
    }

    if (request.status !== RequestStatus.PENDING) {
      throw new AppError(
        "Reschedule request ini sudah diproses sebelumnya",
        409,
      );
    }

    // 🔴 FIX: dibungkus transaction + kirim notifikasi RESCHEDULE_UPDATE —
    // sebelumnya cuma update DB tanpa memberitahu client sama sekali
    return prisma.$transaction(async (tx) => {
      const updated = await tx.rescheduleRequest.update({
        where: { id },
        data: {
          status: RequestStatus.REJECTED,
          adminNote: input.adminNote ?? null,
          processedAt: new Date(),
        },
      });

      await notificationService.createNotification(tx, {
        userId: request.userId,
        orderId: request.orderId,
        type: NotificationType.RESCHEDULE_UPDATE,
        title: "Permintaan Reschedule Ditolak",
        message: `Permintaan reschedule untuk pesanan ${request.order.orderNumber} ditolak. Alasan: ${input.adminNote}`,
      });

      return updated;
    });
  },
};
