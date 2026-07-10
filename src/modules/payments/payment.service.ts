import { prisma } from "../../config/database";
import { AppError } from "../../middlewares/error.middleware";
import { deleteFile, uploadFile } from "../../utils/storage";
import { env } from "../../config/env";
import {
  Payment,
  PaymentStatus,
  OrderStatus,
  PaymentTermType,
  UserRole,
} from "@prisma/client";
import type { UploadProofInput, VerifyPaymentInput } from "./payment.schema";

// ============================================================================
// PAYMENT SERVICE LAYER (CLEAN ARCHITECTURE)
// ============================================================================

export async function uploadProof(
  userId: string,
  paymentId: string,
  input: UploadProofInput,
  file: Express.Multer.File,
): Promise<Payment> {
  // 1. Validasi awal di luar transaksi database
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId, deletedAt: null },
    include: { order: true },
  });

  if (!payment) throw new AppError("Data pembayaran tidak ditemukan", 404);
  if (payment.order.userId !== userId)
    throw new AppError("Akses ditolak. Ini bukan pesanan Anda", 403);

  // 🟡 SOLUSI PERINGATAN: Batasi agar klien tidak bisa menimpa file saat antrean tervalidasi[cite: 7]
  if (
    payment.status !== PaymentStatus.PENDING_UPLOAD &&
    payment.status !== PaymentStatus.REJECTED
  ) {
    throw new AppError(
      "Bukti transfer hanya bisa diunggah pada tagihan berstatus PENDING atau REJECTED",
      400,
    );
  }

  // 🔴 SOLUSI BUG #3: Proses upload ke storage eksternal dilakukan di luar DB transaction block[cite: 7]
  const filePath = `orders/${payment.orderId}/payments/${payment.termType}-${Date.now()}-${file.originalname}`;
  const publicUrl = await uploadFile(
    env.supabaseBucketPaymentProof,
    filePath,
    file.buffer,
    file.mimetype,
  );

  try {
    // 🔴 SOLUSI BUG #3: Buka transaksi database yang pendek dan instan setelah upload sukses[cite: 7]
    return await prisma.$transaction(async (tx) => {
      const updatedPayment = await tx.payment.update({
        where: { id: paymentId },
        data: {
          amountTransferred: input.amountTransferred,
          transferDate: input.transferDate,
          bankAccountId: input.bankAccountId,
          proofImageUrl: publicUrl,
          status: PaymentStatus.WAITING_VERIFICATION,
          uploadedById: userId,
          uploadedAt: new Date(),
        },
      });

      if (payment.termType === PaymentTermType.DOWN_PAYMENT) {
        await tx.order.update({
          where: { id: payment.orderId },
          data: { status: OrderStatus.DP_REVIEW },
        });
      }

      return updatedPayment;
    });
  } catch (error) {
    // 🔴 SOLUSI BUG #3: Mekanisme best-effort cleanup jika database gagal merujuk file[cite: 7]
    await deleteFile(env.supabaseBucketPaymentProof, filePath).catch(() => {});
    throw error;
  }
}

export async function verifyPayment(
  adminId: string,
  paymentId: string,
  input: VerifyPaymentInput,
): Promise<Payment> {
  const { status, rejectionReason } = input;

  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { id: paymentId, deletedAt: null },
      include: { order: true },
    });

    if (!payment) throw new AppError("Data pembayaran tidak ditemukan", 404);
    if (payment.status !== PaymentStatus.WAITING_VERIFICATION) {
      throw new AppError(
        "Pembayaran tidak berada dalam antrean verifikasi admin",
        400,
      );
    }

    // 🟡 SOLUSI PERINGATAN: Cegah admin tidak sengaja menghidupkan order yang sudah CANCELLED/COMPLETED[cite: 7]
    if (
      payment.order.status === OrderStatus.CANCELLED ||
      payment.order.status === OrderStatus.COMPLETED
    ) {
      throw new AppError(
        "Aksi ditolak. Pesanan ini sudah dibatalkan atau selesai dilaksanakan",
        400,
      );
    }

    const verifiedPayment = await tx.payment.update({
      where: { id: paymentId },
      data: {
        status,
        rejectionReason:
          status === PaymentStatus.REJECTED ? (rejectionReason ?? null) : null,
        verifiedById: adminId,
        verifiedAt: new Date(),
      },
    });

    if (status === PaymentStatus.APPROVED) {
      // 🔴 SOLUSI BUG #1 & #2: Penyediaan marker TODO Integrasi modul Invoices & Notifications[cite: 6, 7]
      // TODO: tx.invoice.create(...) -> Otomatisasi pembentukan berkas PDF Invoice[cite: 6, 7]
      // TODO: tx.notification.create(...) -> Kirim trigger NotificationType.PAYMENT_APPROVED[cite: 7]

      if (payment.termType === PaymentTermType.DOWN_PAYMENT) {
        await tx.order.update({
          where: { id: payment.orderId },
          data: { status: OrderStatus.IN_PREPARATION },
        });

        const finalAmountDue = payment.order.grandTotal.sub(payment.amountDue);
        await tx.payment.create({
          data: {
            orderId: payment.orderId,
            termType: PaymentTermType.FINAL_PAYMENT,
            amountDue: finalAmountDue,
            status: PaymentStatus.PENDING_UPLOAD,
          },
        });
      } else if (payment.termType === PaymentTermType.FINAL_PAYMENT) {
        await tx.order.update({
          where: { id: payment.orderId },
          data: { status: OrderStatus.FULLY_PAID },
        });
      }
    } else if (status === PaymentStatus.REJECTED) {
      // TODO: tx.notification.create(...) -> Kirim trigger NotificationType.PAYMENT_REJECTED[cite: 7]
      if (payment.termType === PaymentTermType.DOWN_PAYMENT) {
        await tx.order.update({
          where: { id: payment.orderId },
          data: { status: OrderStatus.PENDING_PAYMENT },
        });
      }
    }

    return verifiedPayment;
  });
}

// 🔴 SOLUSI BUG #4: Implementasi Endpoint GET Riwayat Pembayaran untuk Client & Admin[cite: 7]
export async function getPaymentsByOrder(
  orderId: string,
  userId: string,
  role: UserRole,
): Promise<Payment[]> {
  const order = await prisma.order.findUnique({
    where: { id: orderId, deletedAt: null },
  });

  if (!order) throw new AppError("Pesanan tidak ditemukan", 404);
  if (role !== UserRole.ADMIN && order.userId !== userId) {
    throw new AppError(
      "Akses dilarang. Anda tidak memiliki kepemilikan data atas pesanan ini",
      403,
    );
  }

  return prisma.payment.findMany({
    where: { orderId, deletedAt: null },
    include: { bankAccount: true },
    orderBy: { createdAt: "asc" },
  });
}

// 🔴 SOLUSI BUG #4: Implementasi Endpoint GET Antrean Verifikasi Finansial untuk Admin[cite: 7]
export async function getAdminVerificationQueue(): Promise<Payment[]> {
  return prisma.payment.findMany({
    where: { status: PaymentStatus.WAITING_VERIFICATION, deletedAt: null },
    include: {
      order: {
        select: {
          orderNumber: true,
          status: true,
          user: { select: { name: true, email: true } },
        },
      },
      bankAccount: true,
    },
    orderBy: { uploadedAt: "asc" },
  });
}
