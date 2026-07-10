import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import supertest from "supertest";
import { createApp } from "../../src/app";
import { prisma } from "../../src/config/database";
import { env } from "../../src/config/env";
import {
  OrderStatus,
  PaymentStatus,
  PaymentTermType,
  UserRole,
} from "@prisma/client";
import jwt from "jsonwebtoken";

const app = createApp();
const request = supertest(app);

describe("PAYMENTS ECOSYSTEM INTEGRATION TESTING", () => {
  let mockClientToken: string;
  let mockStrangerToken: string;
  let mockAdminToken: string;
  let mockOrderId: string;
  let mockPaymentId: string;
  let mockBankAccountId: string;
  let mockPackageId: string;

  beforeAll(async () => {
    await prisma.payment.deleteMany();
    await prisma.order.deleteMany();
    await prisma.package.deleteMany();
    await prisma.paymentAccount.deleteMany();

    // 🟡 SOLUSI PERINGATAN: Buat Master Package secara dinamis di level testing, jangan di-hardcode[cite: 7]
    const pkg = await prisma.package.create({
      data: {
        tier: "SILVER",
        name: "Paket Silver Test",
        basePrice: 30000000,
        guestCapacity: 150,
      },
    });
    mockPackageId = pkg.id;

    const account = await prisma.paymentAccount.create({
      data: {
        bankName: "Bank Mandiri",
        accountNumber: "1234567890",
        accountHolder: "PT Janji Seiring",
      },
    });
    mockBankAccountId = account.id;

    mockClientToken = jwt.sign(
      { sub: "client-123", email: "client@mail.com", role: UserRole.CLIENT },
      env.jwtSecret,
    );
    mockStrangerToken = jwt.sign(
      { sub: "user-999", email: "stranger@mail.com", role: UserRole.CLIENT },
      env.jwtSecret,
    );
    mockAdminToken = jwt.sign(
      { sub: "admin-777", email: "admin@mail.com", role: UserRole.ADMIN },
      env.jwtSecret,
    );
  });

  beforeEach(async () => {
    await prisma.payment.deleteMany();
    await prisma.order.deleteMany();

    const order = await prisma.order.create({
      data: {
        orderNumber: `WO-TEST-${Math.random()}`,
        userId: "client-123",
        packageId: mockPackageId,
        status: OrderStatus.PENDING_PAYMENT,
        grandTotal: 30000000,
      },
    });
    mockOrderId = order.id;

    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        termType: PaymentTermType.DOWN_PAYMENT,
        amountDue: 15000000,
        status: PaymentStatus.PENDING_UPLOAD,
      },
    });
    mockPaymentId = payment.id;
  });

  describe("POST /api/v1/payments/:id/verify (Edge-Case Coverage)", () => {
    it("should return 403 Forbidden if a client attempts to upload proof for another user's order", async () => {
      const res = await request
        .post(`/api/v1/payments/${mockPaymentId}/proof`)
        .set("Authorization", `Bearer ${mockStrangerToken}`)
        .field("amountTransferred", "15000000")
        .field("transferDate", "2026-07-10")
        .field("bankAccountId", mockBankAccountId)
        .attach("proof", Buffer.from("mock-image-bytes"), "bukti.jpg");

      expect(res.status).toBe(403); // Ditolak karena validasi kepemilikan data[cite: 7]
    });

    it("should return 400 Bad Request when trying to verify a payment that is not in WAITING_VERIFICATION status", async () => {
      const res = await request
        .post(`/api/v1/payments/${mockPaymentId}/verify`)
        .set("Authorization", `Bearer ${mockAdminToken}`)
        .send({ status: PaymentStatus.APPROVED });

      expect(res.status).toBe(400); // Gagal karena status tagihan masih PENDING_UPLOAD
    });

    it("should successfully roll back order status to PENDING_PAYMENT when admin REJECTS down payment", async () => {
      // 1. Naikkan status pembayaran ke antrean verifikasi
      await prisma.payment.update({
        where: { id: mockPaymentId },
        data: { status: PaymentStatus.WAITING_VERIFICATION },
      });

      // 2. Admin melakukan penolakan
      const res = await request
        .post(`/api/v1/payments/${mockPaymentId}/verify`)
        .set("Authorization", `Bearer ${mockAdminToken}`)
        .send({
          status: PaymentStatus.REJECTED,
          rejectionReason: "Gambar bukti transfer tidak terbaca/terpotong",
        });

      expect(res.status).toBe(200);

      // 3. Pastikan status order utama kembali turun untuk memberikan kesempatan re-upload
      const order = await prisma.order.findUnique({
        where: { id: mockOrderId },
      });
      expect(order?.status).toBe(OrderStatus.PENDING_PAYMENT);
    });
  });
});
