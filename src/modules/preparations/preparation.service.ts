import { prisma } from "../../config/database";
import { AppError } from "../../middlewares/error.middleware";
import * as notificationService from "../notifications/notification.service";
import {
  PreparationTask,
  PreparationStatus,
  OrderStatus,
  NotificationType,
  UserRole,
} from "@prisma/client";
import type { CreateTaskInput, UpdateTaskInput } from "./preparation.schema";

// ============================================================================
// PREPARATION SERVICE
// ============================================================================
//
// Aturan bisnis inti (PRD 4.1 & 6.2):
// - Checklist persiapan dikelola sepenuhnya oleh ADMIN (create/update/delete).
// - Client hanya bisa MELIHAT (read-only) checklist di dashboard mereka.
// - Checklist baru relevan setelah DP disetujui (Order.status = IN_PREPARATION
//   atau lebih lanjut) — sebelum itu belum ada apa pun untuk "dipersiapkan".
// - Setiap perubahan yang terlihat oleh client (task baru / status berubah)
//   memicu notifikasi PREPARATION_UPDATE, sesuai bell icon di PRD 4.8.

// Status order di mana checklist persiapan boleh dikelola
const PREPARATION_ACTIVE_STATUSES: OrderStatus[] = [
  OrderStatus.IN_PREPARATION,
  OrderStatus.FULLY_PAID,
  OrderStatus.COMPLETED,
];

/**
 * Helper: ambil order + validasi kepemilikan/akses. Dipakai bersama oleh
 * getTasksByOrder (client & admin) dan createTask (admin).
 */
async function findAccessibleOrder(
  orderId: string,
  userId: string,
  role: UserRole,
) {
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      deletedAt: null,
      ...(role !== UserRole.ADMIN && { userId }),
    },
  });

  if (!order) {
    throw new AppError(
      "Pesanan tidak ditemukan atau Anda tidak memiliki hak akses",
      404,
    );
  }

  return order;
}

/**
 * 1. [ADMIN] Membuat tugas persiapan baru untuk sebuah order
 */
export async function createTask(
  adminId: string,
  orderId: string,
  input: CreateTaskInput,
): Promise<PreparationTask> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, deletedAt: null },
  });
  if (!order) {
    throw new AppError("Pesanan tidak ditemukan", 404);
  }

  if (!PREPARATION_ACTIVE_STATUSES.includes(order.status)) {
    throw new AppError(
      "Tugas persiapan hanya bisa dibuat setelah DP disetujui (pesanan sudah memasuki tahap persiapan)",
      400,
    );
  }

  return prisma.$transaction(async (tx) => {
    // Kalau sortOrder tidak diisi manual, taruh otomatis di urutan paling akhir
    let sortOrder = input.sortOrder;
    if (sortOrder === undefined) {
      const lastTask = await tx.preparationTask.findFirst({
        where: { orderId },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });
      sortOrder = (lastTask?.sortOrder ?? -1) + 1;
    }

    const task = await tx.preparationTask.create({
      data: {
        orderId,
        title: input.title,
        description: input.description ?? null,
        dueDate: input.dueDate,
        sortOrder,
        updatedById: adminId,
      },
    });

    await notificationService.createNotification(tx, {
      userId: order.userId,
      orderId: order.id,
      type: NotificationType.PREPARATION_UPDATE,
      title: "Checklist Persiapan Diperbarui",
      message: `Tugas persiapan baru ditambahkan untuk pesanan ${order.orderNumber}: "${task.title}"`,
    });

    return task;
  });
}

/**
 * 2. [CLIENT & ADMIN] Mengambil seluruh checklist persiapan milik satu order,
 *    diurutkan sesuai sortOrder (urutan tampilan timeline di dashboard client)
 */
export async function getTasksByOrder(
  orderId: string,
  userId: string,
  role: UserRole,
): Promise<PreparationTask[]> {
  await findAccessibleOrder(orderId, userId, role);

  return prisma.preparationTask.findMany({
    where: { orderId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

/**
 * 3. [ADMIN] Memperbarui satu tugas persiapan (judul, deskripsi, status,
 *    tenggat, atau urutan tampil)
 */
export async function updateTask(
  adminId: string,
  taskId: string,
  input: UpdateTaskInput,
): Promise<PreparationTask> {
  const existingTask = await prisma.preparationTask.findUnique({
    where: { id: taskId },
    include: { order: true },
  });
  if (!existingTask) {
    throw new AppError("Tugas persiapan tidak ditemukan", 404);
  }

  if (existingTask.order.status === OrderStatus.CANCELLED) {
    throw new AppError("Aksi ditolak. Pesanan ini sudah dibatalkan", 400);
  }

  const statusChanged =
    input.status !== undefined && input.status !== existingTask.status;

  return prisma.$transaction(async (tx) => {
    const updatedTask = await tx.preparationTask.update({
      where: { id: taskId },
      data: {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.description !== undefined && {
          description: input.description,
        }),
        ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
        ...(input.dueDate !== undefined && { dueDate: input.dueDate }),
        ...(input.status !== undefined && {
          status: input.status,
          // Auto-set completedAt saat ditandai DONE, auto-clear kalau
          // dipindah kembali ke PENDING/IN_PROGRESS
          completedAt:
            input.status === PreparationStatus.DONE ? new Date() : null,
        }),
        updatedById: adminId,
      },
    });

    // Notifikasi hanya dikirim kalau statusnya benar-benar berubah — supaya
    // client tidak dibanjiri notifikasi tiap kali admin cuma edit deskripsi/typo
    if (statusChanged) {
      const statusLabel =
        updatedTask.status === PreparationStatus.DONE
          ? "selesai"
          : updatedTask.status === PreparationStatus.IN_PROGRESS
            ? "sedang dikerjakan"
            : "tertunda";

      await notificationService.createNotification(tx, {
        userId: existingTask.order.userId,
        orderId: existingTask.order.id,
        type: NotificationType.PREPARATION_UPDATE,
        title: "Checklist Persiapan Diperbarui",
        message: `Tugas "${updatedTask.title}" untuk pesanan ${existingTask.order.orderNumber} kini berstatus ${statusLabel}`,
      });
    }

    return updatedTask;
  });
}

/**
 * 4. [ADMIN] Menghapus tugas persiapan
 */
export async function deleteTask(taskId: string): Promise<void> {
  const existingTask = await prisma.preparationTask.findUnique({
    where: { id: taskId },
  });
  if (!existingTask) {
    throw new AppError("Tugas persiapan tidak ditemukan", 404);
  }

  // Hard delete — model PreparationTask tidak punya kolom soft-delete
  // (deletedAt) di schema, jadi konsisten mengikuti desain schema apa adanya.
  await prisma.preparationTask.delete({ where: { id: taskId } });
}
