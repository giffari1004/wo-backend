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

describe("INVOICES TRANSACTION CORE INTEGRATION TESTING", () => {
  let mockClientToken: string;
  let mockStrangerToken: string;
  let mockOrderId: string;
  let mockPaymentId: string;
  let mockInvoiceNumber: string;
  let mockPackageId: string;

  beforeAll(async () => {
    await prisma.invoice.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.order.deleteMany();
    await prisma.package.deleteMany();

    const pkg = await prisma.package.create({
      data: {
        tier: "PLATINUM",
        name: "Paket Platinum Royal",
        basePrice: 100000000,
        guestCapacity: 500,
      },
    });
    mockPackageId = pkg.id;

    mockClientToken = jwt.sign(
      { sub: "client-555", email: "client555@mail.com", role: UserRole.CLIENT },
      env.jwtSecret,
    );
    mockStrangerToken = jwt.sign(
      {
        sub: "stranger-999",
        email: "stranger999@mail.com",
        role: UserRole.CLIENT,
      },
      env.jwtSecret,
    );
  });

  beforeEach(async () => {
    await prisma.invoice.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.order.deleteMany();

    const order = await prisma.order.create({
      data: {
        orderNumber: `WO-INVTEST-${Math.random()}`,
        userId: "client-555",
        packageId: mockPackageId,
        status: OrderStatus.IN_PREPARATION,
        grandTotal: 100000000,
        packageBasePrice: 100000000,
      },
    });
    mockOrderId = order.id;

    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        termType: PaymentTermType.DOWN_PAYMENT,
        amountDue: 50000000,
        status: PaymentStatus.APPROVED,
      },
    });
    mockPaymentId = payment.id;

    // Trigger pembuatan invoice buatan langsung lewat prisma Client untuk testing pembacaan
    const invoiceNumber = `INV-2026-${Math.floor(100000 + Math.random() * 900000)}`;
    mockInvoiceNumber = invoiceNumber;

    await prisma.invoice.create({
      data: {
        invoiceNumber,
        orderId: order.id,
        paymentId: payment.id,
        amount: 50000000,
        pdfUrl: "https://supabase-storage/inv.pdf",
      },
    });
  });

  describe("GET /api/v1/invoices/:invoiceNumber (Security Ownership Checks)", () => {
    it("should allow data owner client to fetch their invoice specifications", async () => {
      const res = await request
        .get(`/api/v1/invoices/${mockInvoiceNumber}`)
        .set("Authorization", `Bearer ${mockClientToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.invoiceNumber).toBe(mockInvoiceNumber);
      expect(Number(res.body.data.amount)).toBe(50000000);
    });

    it("should return 403 Forbidden when a stranger client tries to peek at the invoice", async () => {
      const res = await request
        .get(`/api/v1/invoices/${mockInvoiceNumber}`)
        .set("Authorization", `Bearer ${mockStrangerToken}`);

      expect(res.status).toBe(403); // Keamanan terjaga dari intaian akun lain[cite: 4]
      expect(res.body.success).toBe(false);
    });

    it("should return 400 Bad Request if the parameters format violates INV-2026 regex mapping", async () => {
      const res = await request
        .get("/api/v1/invoices/INV-NGANJUK-NOTVALID")
        .set("Authorization", `Bearer ${mockClientToken}`);

      expect(res.status).toBe(400); // Tertahan filter regex Zod schema[cite: 7]
    });
  });
});
