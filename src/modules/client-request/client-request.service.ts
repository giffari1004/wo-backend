import { prisma } from "@/config/database";
import { AppError } from "@/middlewares/error.middleware";
import * as notificationService from "../notifications/notification.service";
import { RequestStatus, OrderStatus, NotificationType } from "@prisma/client";
import type {
  CreateClientRequestInput,
  ReplyClientRequestInput,
  ListClientRequestQuery,
} from "./client-request.schema";

// 🔴 FIX: sebelumnya cuma blacklist OrderStatus.DRAFT — order yang sudah
// CANCELLED masih lolos kirim request. Diganti jadi whitelist eksplisit,
// konsisten dengan pola RESCHEDULABLE_STATUSES di reschedule-request.service.ts
// (lebih aman: status baru yang ditambahkan nanti default "tidak diizinkan"
// sampai eksplisit dimasukkan ke daftar, bukan sebaliknya).
const REQUEST_ALLOWED_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING_PAYMENT,
  OrderStatus.DP_REVIEW,
  OrderStatus.IN_PREPARATION,
  OrderStatus.FULLY_PAID,
  OrderStatus.COMPLETED,
];

/**
 * Pastikan order ada dan dimiliki oleh user yang sedang login.
 * Dipakai di semua endpoint client-facing (bukan admin).
 */
async function assertOrderOwnership(orderId: string, userId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, deletedAt: null },
    select: { id: true, userId: true, status: true },
  });

  if (!order) {
    throw new AppError("Order tidak ditemukan", 404);
  }

  if (order.userId !== userId) {
    throw new AppError("Anda tidak memiliki akses ke order ini", 403);
  }

  if (!REQUEST_ALLOWED_STATUSES.includes(order.status)) {
    throw new AppError(
      "Request khusus hanya bisa dikirim untuk pesanan yang sudah diajukan dan belum dibatalkan",
      400,
    );
  }

  return order;
}

export const clientRequestService = {
  async create(
    orderId: string,
    userId: string,
    input: CreateClientRequestInput,
  ) {
    await assertOrderOwnership(orderId, userId);

    return prisma.clientRequest.create({
      data: {
        orderId,
        userId,
        subject: input.subject,
        message: input.message,
      },
    });
  },

  async listByOrder(orderId: string, userId: string) {
    await assertOrderOwnership(orderId, userId);

    return prisma.clientRequest.findMany({
      where: { orderId },
      orderBy: { createdAt: "desc" },
    });
  },

  // 🔴 FIX: tambah filter orderId — admin butuh lihat riwayat request khusus
  // satu order (dipakai di halaman Detail Order, PRD 6.2), bukan cuma daftar
  // global ter-paginasi tanpa konteks order mana pun.
  async listAllForAdmin(query: ListClientRequestQuery) {
    const { status, orderId, page, limit } = query;
    const where = {
      ...(status && { status: status as RequestStatus }),
      ...(orderId && { orderId }),
    };

    const [items, total] = await Promise.all([
      prisma.clientRequest.findMany({
        where,
        include: {
          order: { select: { orderNumber: true } },
          user: { select: { name: true, email: true, phone: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.clientRequest.count({ where }),
    ]);

    return {
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  async getById(id: string) {
    const request = await prisma.clientRequest.findUnique({
      where: { id },
      include: {
        order: { select: { orderNumber: true, weddingDate: true } },
        user: { select: { name: true, email: true, phone: true } },
      },
    });

    if (!request) {
      throw new AppError("Request tidak ditemukan", 404);
    }

    return request;
  },

  // 🔴 FIX: sekarang mengirim notifikasi NotificationType.REQUEST_REPLIED ke
  // client setelah admin membalas — sebelumnya cuma update DB tanpa
  // memberitahu client sama sekali (bell icon PRD 4.8 tidak pernah menyala
  // untuk kasus ini). Dibungkus transaction supaya update + notifikasi atomic.
  async reply(id: string, input: ReplyClientRequestInput) {
    const existing = await prisma.clientRequest.findUnique({
      where: { id },
      include: { order: { select: { id: true, orderNumber: true } } },
    });

    if (!existing) {
      throw new AppError("Request tidak ditemukan", 404);
    }

    if (
      existing.status === RequestStatus.APPROVED ||
      existing.status === RequestStatus.REJECTED
    ) {
      throw new AppError(
        "Request ini sudah diputuskan sebelumnya dan tidak dapat diubah",
        409,
      );
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.clientRequest.update({
        where: { id },
        data: {
          adminReply: input.adminReply,
          status: input.status as RequestStatus,
          repliedAt: new Date(),
        },
      });

      await notificationService.createNotification(tx, {
        userId: existing.userId,
        orderId: existing.orderId,
        type: NotificationType.REQUEST_REPLIED,
        title: "Admin Membalas Request Anda",
        message: `Request "${existing.subject}" untuk pesanan ${existing.order.orderNumber} telah dibalas oleh admin.`,
      });

      return updated;
    });
  },
};
