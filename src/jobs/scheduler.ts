import cron from "node-cron";
import { prisma } from "../config/database";
import { logger } from "../config/logger";
import { sendPaymentReminderEmail } from "../config/mailer";
import * as notificationService from "../modules/notifications/notification.service";
import {
  OrderStatus,
  PaymentTermType,
  PaymentStatus,
  NotificationType,
} from "@prisma/client";

/**
 * Registrasi semua scheduled jobs.
 * Dipanggil sekali dari server.ts saat aplikasi start.
 */
export function registerJobs(): void {
  // ── Job 1: Reminder pelunasan ─────────────────────────────────────
  // Jalankan setiap hari jam 08:00 pagi
  // Kirim reminder (email + in-app notification) ke client yang DP sudah
  // confirmed tapi belum lunas, TEPAT saat wedding-nya H-30.
  cron.schedule("0 8 * * *", async () => {
    logger.info("[CRON] Running payment reminder job");
    try {
      // 🔴 FIX: sebelumnya pakai `weddingDate <= 30 hari dari sekarang`,
      // yang tetap `true` SETIAP HARI selama order masih dalam radius 30
      // hari — akibatnya client bisa dapat email reminder berkali-kali
      // (spam) selama sebulan penuh, bukan sekali di hari H-30 seperti
      // maksud komentarnya. Sekarang dicocokkan ke SATU hari spesifik saja:
      // rentang [H-30 00:00, H-30 23:59:59] — jadi cuma nyala sekali.
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 30);
      const rangeStart = new Date(targetDate);
      rangeStart.setUTCHours(0, 0, 0, 0);
      const rangeEnd = new Date(targetDate);
      rangeEnd.setUTCHours(23, 59, 59, 999);

      const orders = await prisma.order.findMany({
        where: {
          status: OrderStatus.IN_PREPARATION,
          weddingDate: { gte: rangeStart, lte: rangeEnd },
          deletedAt: null,
          payments: {
            none: {
              termType: PaymentTermType.FINAL_PAYMENT,
              status: PaymentStatus.APPROVED,
            },
          },
        },
        include: {
          user: true,
          payments: { where: { termType: PaymentTermType.FINAL_PAYMENT } },
        },
      });

      for (const order of orders) {
        try {
          await sendPaymentReminderEmail({
            to: order.user.email,
            clientName: order.user.name,
            orderNumber: order.orderNumber,
            weddingDate: order.weddingDate!.toLocaleDateString("id-ID"),
            amount: order.grandTotal.toString(),
          });

          // 🆕 Sekalian kirim notifikasi in-app — schema sudah punya
          // NotificationType.PAYMENT_REMINDER khusus untuk kasus ini, tapi
          // sebelumnya cuma email yang jalan, bell icon client tidak pernah
          // menyala untuk reminder pelunasan.
          await prisma.$transaction(async (tx) => {
            await notificationService.createNotification(tx, {
              userId: order.userId,
              orderId: order.id,
              type: NotificationType.PAYMENT_REMINDER,
              title: "Reminder Pelunasan",
              message: `Pelunasan untuk pesanan ${order.orderNumber} jatuh tempo H-30 menuju tanggal pernikahan Anda (${order.weddingDate!.toLocaleDateString("id-ID")}).`,
            });
          });

          logger.info(
            `[CRON] Reminder sent to ${order.user.email} for order ${order.orderNumber}`,
          );
        } catch (err) {
          logger.error(
            err,
            `[CRON] Failed to send reminder for order ${order.orderNumber}`,
          );
          // Lanjut ke order berikutnya — satu kegagalan kirim (mis. email
          // bounce) tidak boleh menghentikan reminder untuk order lain
        }
      }
    } catch (err) {
      logger.error(err, "[CRON] Payment reminder job failed");
    }
  });

  // ── Job 2: Tandai order COMPLETED setelah tanggal wedding lewat ───
  // Jalankan setiap hari jam 00:05 dini hari
  cron.schedule("5 0 * * *", async () => {
    logger.info("[CRON] Running mark-completed job");
    try {
      // Batas waktu: wedding date sudah lewat MINIMAL 1 hari penuh,
      // dinormalisasi ke tengah malam supaya tidak kena masalah
      // perbandingan jam/menit dari `new Date()` yang membawa waktu saat ini.
      const cutoff = new Date();
      cutoff.setUTCHours(0, 0, 0, 0);

      // 🔴 FIX dibanding versi sebelumnya: pakai findMany dulu (bukan
      // langsung updateMany polos) supaya kita punya daftar order+userId
      // untuk dikirimi notifikasi satu-satu — updateMany tidak punya
      // hook/return data per-row.
      const ordersToComplete = await prisma.order.findMany({
        where: {
          status: OrderStatus.FULLY_PAID,
          weddingDate: { lt: cutoff },
          deletedAt: null,
        },
        select: { id: true, orderNumber: true, userId: true },
      });

      if (ordersToComplete.length === 0) {
        logger.info("[CRON] No orders to mark as completed");
        return;
      }

      // Proses satu-satu dalam transaksi kecil per order — kalau satu order
      // gagal, order lain tetap lanjut diproses, tidak saling menggagalkan.
      let successCount = 0;
      for (const order of ordersToComplete) {
        try {
          await prisma.$transaction(async (tx) => {
            await tx.order.update({
              where: { id: order.id },
              data: {
                status: OrderStatus.COMPLETED,
                completedAt: new Date(),
              },
            });

            // 🆕 Notifikasi ke client — tidak ada di versi sebelumnya.
            // Dipakai NotificationType.GENERAL karena belum ada tipe khusus
            // "ORDER_COMPLETED" di schema saat ini.
            await notificationService.createNotification(tx, {
              userId: order.userId,
              orderId: order.id,
              type: NotificationType.GENERAL,
              title: "Selamat! Acara Anda Telah Selesai",
              message: `Pesanan ${order.orderNumber} telah ditandai selesai. Terima kasih telah mempercayakan hari bahagia Anda kepada kami!`,
            });
          });
          successCount++;
        } catch (err) {
          logger.error(
            err,
            `[CRON] Failed to mark order ${order.orderNumber} as completed`,
          );
        }
      }

      logger.info(
        `[CRON] Marked ${successCount}/${ordersToComplete.length} orders as COMPLETED`,
      );
    } catch (err) {
      logger.error(err, "[CRON] Mark-completed job failed");
    }
  });

  logger.info("[CRON] All jobs registered");
}
