import { prisma } from "@/config/database";
import { AppError } from "@/middlewares/error.middleware";
import {
  OrderVendor,
  OrderStatus,
  VendorCategory,
  UserRole,
  Prisma,
} from "@prisma/client";
import type { SelectVendorInput } from "./order-vendor.schema";

// ============================================================================
// ORDER VENDOR SERVICE (REPAIRED & ROBUST VERSION)
// ============================================================================

/**
 * 1. Memproses Pemilihan / Pembaruan Vendor Per Step (Step 1-5)
 */
export async function selectVendor(
  userId: string,
  input: SelectVendorInput,
): Promise<OrderVendor> {
  const { orderId, category, vendorId, cateringMenuId } = input;

  // 🟡 SOLUSI RACE CONDITION: Membungkus seluruh rangkaian pembacaan & penulisan ke dalam Transaksi Atomis[cite: 7]
  return prisma.$transaction(async (tx) => {
    // 1. Ambil data order beserta relasi paket bawaannya untuk kebutuhan fallback kapasitas[cite: 5, 7]
    const order = await tx.order.findFirst({
      where: {
        id: orderId,
        userId,
        status: OrderStatus.DRAFT,
        deletedAt: null,
      },
      include: { package: true },
    });
    if (!order) {
      throw new AppError(
        "Aksi ditolak. Draf pesanan tidak ditemukan atau sudah diajukan",
        404,
      );
    }

    // 2. Pastikan master vendor eksis, sesuai kategori step, dan aktif
    const vendor = await tx.vendor.findFirst({
      where: { id: vendorId, category, isActive: true, deletedAt: null },
    });
    if (!vendor) {
      throw new AppError(
        `Master vendor aktif tidak ditemukan pada kategori ${category}`,
        404,
      );
    }

    // 3. Validasi perlindungan ketersediaan jadwal kalender (Pencegahan Double-Booking)
    if (order.weddingDate) {
      const isBooked = await tx.vendorAvailability.findFirst({
        where: {
          vendorId,
          date: order.weddingDate,
          isBlocked: true,
          NOT: { orderId }, // Abaikan jika diblokir oleh draf milik sendiri
        },
        include: { vendor: { select: { name: true } } },
      });

      if (isBooked) {
        throw new AppError(
          `Vendor '${isBooked.vendor.name}' sudah penuh atau dipesan pada tanggal tersebut`,
          409,
        );
      }
    }

    // 4. Cek Relasi Paket Bawaan (Default vs Upgrade)
    const isPackageDefault = await tx.packageVendor.findFirst({
      where: { packageId: order.packageId, vendorId, isDefault: true },
    });

    let finalMenuId: string | null = null;
    let priceSnapshot = new Prisma.Decimal(0);

    // 🔴 SOLUSI BUG #1 & #3: Memisahkan cabang logis kategori CATERING agar tidak tertimpa[cite: 7]
    if (category === VendorCategory.CATERING) {
      if (!cateringMenuId) {
        throw new AppError(
          "Paket menu katering wajib dipilih jika memilih vendor kategori CATERING",
          400,
        );
      }

      const menu = await tx.cateringMenu.findFirst({
        where: {
          id: cateringMenuId,
          vendorId,
          isActive: true,
          deletedAt: null,
        },
      });
      if (!menu) {
        throw new AppError(
          "Paket menu katering pilihan tidak valid untuk vendor ini",
          400,
        );
      }

      finalMenuId = menu.id;

      // 🔴 SOLUSI BUG #3: Fallback ke package.guestCapacity jika order.guestCount kosong/null[cite: 5, 7]
      const currentGuests =
        order.guestCount && order.guestCount > 0
          ? order.guestCount
          : order.package.guestCapacity;

      // Kalkulasi catering murni per pax × jumlah porsi (tidak dipengaruhi basePrice vendor)[cite: 2, 7]
      priceSnapshot = new Prisma.Decimal(menu.pricePerPax).mul(currentGuests);
    } else {
      // 🔴 SOLUSI BUG #2: Mencegah Double-Charging untuk Vendor Non-Catering[cite: 7]
      // Jika bawaan paket -> priceAtBooking = 0 (karena sudah di-cover oleh packageBasePrice)[cite: 5, 7]
      // Jika di luar paket (Upgrade) -> Hanya bebankan upgradeFee saja (bukan basePrice + upgradeFee)[cite: 5, 7]
      priceSnapshot = isPackageDefault
        ? new Prisma.Decimal(0)
        : new Prisma.Decimal(vendor.upgradeFee);
    }

    // 🔴 SOLUSI BUG #4: Sinkronisasi pembersihan data jika klien mengubah pilihan vendor lamanya[cite: 5, 7]
    const existingSelection = await tx.orderVendor.findUnique({
      where: { orderId_category: { orderId, category } },
    });

    if (
      existingSelection &&
      existingSelection.vendorId !== vendorId &&
      order.weddingDate
    ) {
      // Hapus blokir jadwal dari vendor lama khusus untuk order ini
      await tx.vendorAvailability.deleteMany({
        where: {
          orderId,
          vendorId: existingSelection.vendorId,
          date: order.weddingDate,
        },
      });
    }

    // 🔴 SOLUSI BUG #4: Menulis data pemblokiran resmi ke tabel VendorAvailability (Real-Time Booking)[cite: 5, 7]
    if (order.weddingDate) {
      await tx.vendorAvailability.upsert({
        where: {
          vendorId_date: { vendorId, date: order.weddingDate },
        },
        create: {
          vendorId,
          date: order.weddingDate,
          isBlocked: true,
          reason: `Di-booking sementara oleh Order draf ${order.orderNumber || orderId}`,
          orderId,
        },
        update: {
          isBlocked: true,
          reason: `Di-booking sementara oleh Order draf ${order.orderNumber || orderId}`,
          orderId,
        },
      });
    }

    // 5. Jalankan Upsert data pilihan vendor ke database
    return tx.orderVendor.upsert({
      where: {
        orderId_category: { orderId, category },
      },
      update: {
        vendorId,
        cateringMenuId: finalMenuId,
        isUpgrade: !isPackageDefault,
        priceAtBooking: priceSnapshot,
      },
      create: {
        orderId,
        category,
        vendorId,
        cateringMenuId: finalMenuId,
        isUpgrade: !isPackageDefault,
        priceAtBooking: priceSnapshot,
      },
      include: { vendor: true, cateringMenu: true },
    });
  });
}

/**
 * 2. Mengambil Seluruh Vendor yang Sudah Dipilih dalam Satu Order (Client & Admin)
 */
export async function getVendorsByOrder(
  orderId: string,
  userId: string,
  role: UserRole, // 🟢 SOLUSI KONSISTENSI: Mengganti string literal menjadi tipe Enum UserRole[cite: 5, 7]
): Promise<OrderVendor[]> {
  const orderExists = await prisma.order.findFirst({
    where: {
      id: orderId,
      deletedAt: null,
      ...(role !== UserRole.ADMIN && { userId }),
    },
  });
  if (!orderExists)
    throw new AppError(
      "Pesanan tidak ditemukan atau Anda tidak memiliki hak akses",
      404,
    );

  return prisma.orderVendor.findMany({
    where: { orderId },
    include: { vendor: true, cateringMenu: true },
    orderBy: { category: "asc" },
  });
}

/**
 * 3. Mengambil Satu Vendor Terpilih Spesifik Berdasarkan Kategori Step Form
 */
export async function getVendorByCategory(
  orderId: string,
  category: VendorCategory,
  userId: string,
  role: UserRole, // 🟢 SOLUSI KONSISTENSI: Mengganti string literal menjadi tipe Enum UserRole[cite: 5, 7]
): Promise<OrderVendor> {
  const orderExists = await prisma.order.findFirst({
    where: {
      id: orderId,
      deletedAt: null,
      ...(role !== UserRole.ADMIN && { userId }),
    },
  });
  if (!orderExists)
    throw new AppError(
      "Pesanan tidak ditemukan atau Anda tidak memiliki hak akses",
      404,
    );

  const selection = await prisma.orderVendor.findUnique({
    where: { orderId_category: { orderId, category } },
    include: { vendor: true, cateringMenu: true },
  });

  if (!selection)
    throw new AppError(
      `Vendor untuk kategori ${category} belum dipilih pada pesanan ini`,
      404,
    );
  return selection;
}
