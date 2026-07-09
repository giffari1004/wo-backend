import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import supertest from "supertest";
import { createApp } from "../../src/app";
import { prisma } from "../../src/config/database";
import { env } from "../../src/config/env"; // Pastikan path env sesuai dengan struktur project kamu[cite: 4]
import { OrderStatus, VendorCategory, UserRole } from "@prisma/client";
import jwt from "jsonwebtoken"; // Import library JWT untuk generate token testing[cite: 4]

const app = createApp();
const request = supertest(app);

describe("ORDER VENDORS ROBUST INTEGRATION TESTING", () => {
  let mockUserToken: string; // Deklarasi variabel token
  let mockOrderId: string;
  let mockPackageId: string;
  let mockVenueVendorId: string;
  let mockCateringVendorId: string;
  let mockCateringMenuId: string;

  beforeAll(async () => {
    // 1. Bersihkan database transaksi lokal untuk testing
    await prisma.orderVendor.deleteMany();
    await prisma.vendorAvailability.deleteMany();
    await prisma.order.deleteMany();
    await prisma.cateringMenu.deleteMany();
    await prisma.vendor.deleteMany();
    await prisma.package.deleteMany();

    // 2. Setup Master Paket Standar
    const pkg = await prisma.package.create({
      data: {
        tier: "GOLD",
        name: "Paket Gold Juwita",
        basePrice: 50000000,
        guestCapacity: 300,
      },
    });
    mockPackageId = pkg.id;

    // 3. Setup Master Vendor Gedung & Katering
    const venue = await prisma.vendor.create({
      data: {
        category: VendorCategory.VENUE,
        name: "Gedung Sasana Kriya",
        basePrice: 15000000,
        upgradeFee: 3000000,
        isActive: true,
      },
    });
    mockVenueVendorId = venue.id;

    const catering = await prisma.vendor.create({
      data: {
        category: VendorCategory.CATERING,
        name: "Sinar Utama Catering",
        basePrice: 0,
        upgradeFee: 0,
        isActive: true,
      },
    });
    mockCateringVendorId = catering.id;

    const menu = await prisma.cateringMenu.create({
      data: {
        vendorId: catering.id,
        name: "Menu Nusantara Raya",
        pricePerPax: 75000,
        menuItems: ["Nasi Putih", "Ayam Bakar Taliwang", "Es Doger"],
        isActive: true,
      },
    });
    mockCateringMenuId = menu.id;

    // Tambahkan relasi package vendor default untuk Venue
    await prisma.packageVendor.create({
      data: {
        packageId: pkg.id,
        vendorId: venue.id,
        category: VendorCategory.VENUE,
        isDefault: true,
      },
    });

    // ✅ SOLUSI: Mengisi nilai mockUserToken di dalam sebelum test dimulai agar lulus check TypeScript[cite: 5]
    mockUserToken = jwt.sign(
      {
        sub: "clm-user-id-placeholder",
        email: "test@pengantin.com",
        role: UserRole.CLIENT,
      },
      env.jwtSecret, // Menggunakan secret key asli dari konfigurasi aplikasi[cite: 4, 5]
      { expiresIn: "1h" },
    );
  });

  // Segarkan state Order draf setiap sebelum melangkah ke case test berikutnya
  beforeEach(async () => {
    await prisma.orderVendor.deleteMany();
    await prisma.vendorAvailability.deleteMany();
    await prisma.order.deleteMany();

    // Buat draf order baru milik user pengantin
    const order = await prisma.order.create({
      data: {
        orderNumber: `WO-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        userId: "clm-user-id-placeholder", // Sesuai dengan id 'sub' pada payload JWT di atas[cite: 5]
        packageId: mockPackageId,
        status: OrderStatus.DRAFT,
        weddingDate: new Date("2026-10-10"),
        guestCount: null,
      },
    });
    mockOrderId = order.id;
  });

  describe("POST /api/v1/order-vendors/select (Core Business Logic)", () => {
    it("should process happy path package default with 0 additional booking price", async () => {
      const res = await request
        .post("/api/v1/order-vendors/select")
        .set("Authorization", `Bearer ${mockUserToken}`) // ✅ Token sudah terinisialisasi dengan aman
        .send({
          orderId: mockOrderId,
          category: VendorCategory.VENUE,
          vendorId: mockVenueVendorId,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Number(res.body.data.priceAtBooking)).toBe(0);
      expect(res.body.data.isUpgrade).toBe(false);
    });

    it("should calculate catering price correctly using package.guestCapacity as fallback", async () => {
      const res = await request
        .post("/api/v1/order-vendors/select")
        .set("Authorization", `Bearer ${mockUserToken}`) // ✅ Ditambahkan agar tidak terkena 401 Unauthorized[cite: 9]
        .send({
          orderId: mockOrderId,
          category: VendorCategory.CATERING,
          vendorId: mockCateringVendorId,
          cateringMenuId: mockCateringMenuId,
        });

      expect(res.status).toBe(200);
      expect(Number(res.body.data.priceAtBooking)).toBe(22500000);
    });

    it("should reject assignment with 409 conflict when vendor date is already blocked", async () => {
      // Buat pemblokiran buatan pada hari H untuk vendor tersebut
      await prisma.vendorAvailability.create({
        data: {
          vendorId: mockVenueVendorId,
          date: new Date("2026-10-10"),
          isBlocked: true,
          reason: "Sudah dipesan klien eksternal",
        },
      });

      const res = await request
        .post("/api/v1/order-vendors/select")
        .set("Authorization", `Bearer ${mockUserToken}`) // ✅ Ditambahkan agar lolos Auth guard[cite: 9]
        .send({
          orderId: mockOrderId,
          category: VendorCategory.VENUE,
          vendorId: mockVenueVendorId,
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain("sudah penuh atau dipesan");
    });

    it("should demonstrate clean overwrite upsert constraints when client changes selection", async () => {
      // Input pemilihan awal
      await request
        .post("/api/v1/order-vendors/select")
        .set("Authorization", `Bearer ${mockUserToken}`)
        .send({
          orderId: mockOrderId,
          category: VendorCategory.VENUE,
          vendorId: mockVenueVendorId,
        });

      // Klien berubah pikiran pada step yang sama, mengunggah vendor baru
      const res = await request
        .post("/api/v1/order-vendors/select")
        .set("Authorization", `Bearer ${mockUserToken}`)
        .send({
          orderId: mockOrderId,
          category: VendorCategory.VENUE,
          vendorId: mockVenueVendorId,
        });

      expect(res.status).toBe(200);

      const count = await prisma.orderVendor.count({
        where: { orderId: mockOrderId, category: VendorCategory.VENUE },
      });
      expect(count).toBe(1);
    });
  });
});
