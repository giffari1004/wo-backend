import { prisma } from "@/config/database";
import { AppError } from "@/middlewares/error.middleware";
import { withSerializableRetry } from "@/utils/prisma-retry";
import {
  OrderVendor,
  OrderStatus,
  VendorCategory,
  UserRole,
  Prisma,
} from "@prisma/client";
import type { SelectVendorInput } from "./order-vendor.schema";

// ============================================================================
// ORDER VENDOR SERVICE (REPAIRED & ROBUST VERSION v2)
// ============================================================================

/**
 * 1. Memproses Pemilihan / Pembaruan Vendor Per Step (Step 1-5)
 */
export async function selectVendor(
  userId: string,
  input: SelectVendorInput,
): Promise<OrderVendor> {
  const { orderId, category, vendorId, cateringMenuId } = input;

  // 🟡 RACE CONDITION FIX: Isolation level dinaikkan ke Serializable.
 
  return prisma.$transaction(
    async (tx) => {
      // 1. Ambil data order beserta relasi paket bawaannya untuk kebutuhan fallback kapasitas
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

        // Fallback ke package.guestCapacity jika order.guestCount kosong/null
        const currentGuests =
          order.guestCount && order.guestCount > 0
            ? order.guestCount
            : order.package.guestCapacity;

        // Kalkulasi catering murni per pax × jumlah porsi (tidak dipengaruhi basePrice vendor)
        priceSnapshot = new Prisma.Decimal(menu.pricePerPax).mul(currentGuests);
      } else {
        // Bawaan paket -> priceAtBooking = 0 (sudah di-cover packageBasePrice)
        // Di luar paket (Upgrade) -> hanya bebankan upgradeFee saja
        priceSnapshot = isPackageDefault
          ? new Prisma.Decimal(0)
          : new Prisma.Decimal(vendor.upgradeFee);
      }

      // 5. 🔴 FIX CLEANUP BLOK LAMA: bukan hanya saat ganti vendor, tapi juga saat tanggal berubah
      //
      
      const existingSelection = await tx.orderVendor.findUnique({
        where: { orderId_category: { orderId, category } },
      });

      if (existingSelection) {
        await tx.vendorAvailability.deleteMany({
          where: {
            orderId,
            vendorId: existingSelection.vendorId,
          },
        });
      }

      // 6. Tulis ulang blokir tanggal yang valid untuk pilihan vendor saat ini
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

      // 7. Jalankan Upsert data pilihan vendor ke database
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
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5000, // ms menunggu slot transaksi kosong
      timeout: 10000, // ms — dinaikkan dari default 5s karena Serializable + beberapa query berantai
    },
  );
}

/**
 * 2. Mengambil Seluruh Vendor yang Sudah Dipilih dalam Satu Order (Client & Admin)
 */
export async function getVendorsByOrder(
  orderId: string,
  userId: string,
  role: UserRole,
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
  role: UserRole,
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
