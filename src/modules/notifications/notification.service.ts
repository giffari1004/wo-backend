import { prisma } from "../../config/database";
import { AppError } from "../../middlewares/error.middleware";
import { Notification, NotificationType, Prisma } from "@prisma/client";
import type { ListNotificationQuery } from "./notification.schema";

// ============================================================================
// NOTIFICATION SERVICE — MODUL PENUH
// ============================================================================
//
// Sebelumnya file ini cuma berisi helper minimal `createNotification`, dipakai
// internal oleh modul lain (payments, preparation, rsvp, client-request,
// reschedule-request) untuk menulis baris notifikasi di dalam transaksi
// masing-masing. Sekarang diperluas jadi modul penuh dengan endpoint
// client-facing (bell icon — PRD 4.8), TANPA mengubah signature
// `createNotification` supaya seluruh pemanggilan yang sudah ada di modul
// lain tetap jalan tanpa perlu disentuh.

interface CreateNotificationInput {
  userId: string;
  orderId?: string | null;
  type: NotificationType;
  title: string;
  message: string;
}

/**
 * [INTERNAL] Menulis satu baris notifikasi. Dipakai modul lain — SELALU di
 * dalam transaksi yang sama dengan perubahan status yang memicunya, supaya
 * keduanya konsisten (sama-sama commit atau sama-sama rollback).
 */
export async function createNotification(
  tx: Prisma.TransactionClient,
  input: CreateNotificationInput,
) {
  return tx.notification.create({
    data: {
      userId: input.userId,
      orderId: input.orderId ?? null,
      type: input.type,
      title: input.title,
      message: input.message,
    },
  });
}

/**
 * 1. [CLIENT/ADMIN — self only] Daftar notifikasi milik user yang login,
 *    dengan pagination + filter status baca.
 */
export async function getMyNotifications(
  userId: string,
  query: ListNotificationQuery,
) {
  const { isRead, page, limit } = query;

  const where = {
    userId,
    ...(isRead !== undefined && { isRead }),
  };

  const [items, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);

  return {
    items,
    unreadCount,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

/**
 * 2. [CLIENT/ADMIN — self only] Hitung notifikasi belum dibaca —
 *    dipakai buat badge angka di bell icon, dipanggil sering, sengaja
 *    dibuat query ringan (cuma count, bukan ambil semua data).
 */
export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, isRead: false } });
}

/**
 * 3. [CLIENT/ADMIN — self only] Tandai satu notifikasi sebagai sudah dibaca
 */
export async function markAsRead(
  userId: string,
  notificationId: string,
): Promise<Notification> {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) {
    throw new AppError("Notifikasi tidak ditemukan", 404);
  }
  if (notification.userId !== userId) {
    throw new AppError("Anda tidak memiliki akses ke notifikasi ini", 403);
  }

  // Idempotent — kalau sudah kebaca sebelumnya, tidak perlu error, cukup
  // kembalikan apa adanya (client mungkin double-tap, itu wajar)
  if (notification.isRead) {
    return notification;
  }

  return prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });
}

/**
 * 4. [CLIENT/ADMIN — self only] Tandai SEMUA notifikasi milik user sebagai
 *    sudah dibaca (tombol "Tandai semua terbaca" yang umum di UI bell icon)
 */
export async function markAllAsRead(
  userId: string,
): Promise<{ count: number }> {
  const result = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
  return { count: result.count };
}

/**
 * 5. [CLIENT/ADMIN — self only] Hapus satu notifikasi
 */
export async function deleteNotification(
  userId: string,
  notificationId: string,
): Promise<void> {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) {
    throw new AppError("Notifikasi tidak ditemukan", 404);
  }
  if (notification.userId !== userId) {
    throw new AppError("Anda tidak memiliki akses ke notifikasi ini", 403);
  }

  // Hard delete — model Notification tidak punya kolom soft-delete di schema
  await prisma.notification.delete({ where: { id: notificationId } });
}
