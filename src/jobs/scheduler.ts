import cron from "node-cron";
import { prisma } from "../config/database";
import { logger } from "@/config/logger";
import { sendPaymentReminderEmail } from "@/config/mailer";

/**
 * Registrasi semua scheduled jobs.
 * Dipanggil sekali dari server.ts saat aplikasi start.
 */
export function registerJobs(): void {
  // ── Job 1: Reminder pelunasan ─────────────────────────────────────
  // Jalankan setiap hari jam 08:00 pagi
  // Kirim email reminder ke client yang DP sudah confirmed tapi
  // belum lunas, dan H-30 menuju tanggal wedding
  cron.schedule("0 8 * * *", async () => {
    logger.info("[CRON] Running payment reminder job");
    try {
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      const orders = await prisma.order.findMany({
        where: {
          status: "IN_PREPARATION",
          weddingDate: { lte: thirtyDaysFromNow },
          deletedAt: null,
          payments: {
            none: { termType: "FINAL_PAYMENT", status: "APPROVED" },
          },
        },
        include: {
          user: true,
          payments: { where: { termType: "FINAL_PAYMENT" } },
        },
      });

      for (const order of orders) {
        await sendPaymentReminderEmail({
          to: order.user.email,
          clientName: order.user.name,
          orderNumber: order.orderNumber,
          weddingDate: order.weddingDate!.toLocaleDateString("id-ID"),
          amount: order.grandTotal.toString(),
        });
        logger.info(
          `[CRON] Reminder sent to ${order.user.email} for order ${order.orderNumber}`,
        );
      }
    } catch (err) {
      logger.error(err, "[CRON] Payment reminder job failed");
    }
  });

  // ── Job 2: Tandai order COMPLETED setelah tanggal wedding lewat ───
  // Jalankan setiap jam 00:05 dini hari
  cron.schedule("5 0 * * *", async () => {
    logger.info("[CRON] Running mark-completed job");
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const result = await prisma.order.updateMany({
        where: {
          status: "FULLY_PAID",
          weddingDate: { lt: yesterday },
          deletedAt: null,
        },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
        },
      });

      logger.info(`[CRON] Marked ${result.count} orders as COMPLETED`);
    } catch (err) {
      logger.error(err, "[CRON] Mark-completed job failed");
    }
  });

  logger.info("[CRON] All jobs registered");
}
