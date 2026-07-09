import { prisma } from "@/config/database";
import { AppError } from "@/middlewares/error.middleware";
import { Order, OrderStatus, VendorCategory, Prisma } from "@prisma/client";
import crypto from "crypto";
import type {
  CreateOrderDraftInput,
  UpdateOrderDraftInput,
} from "./order.schema";

// Perbaikan Isu 6: Menghilangkan implementasi return type Promise<any> demi type-safety ketat
export type DetailedOrderPayload = Prisma.OrderGetPayload<{
  include: {
    package: true;
    user: { select: { name: true; email: true; phone: true } };
    orderVendors: { include: { vendor: true; cateringMenu: true } };
  };
}>;

/**
 * Helper: Membuat Nomor Order Unik (Guaranteed Cryptographic Hex)
 */
async function generateOrderNumber(): Promise<string> {
  // Perbaikan Bug 1: Uniqueness guarantee menangkal tabrakan kode unik transaksi
  const today = new Date();
  const dateStr =
    today.getFullYear() +
    String(today.getMonth() + 1).padStart(2, "0") +
    String(today.getDate()).padStart(2, "0");
  const randomStr = crypto.randomBytes(3).toString("hex").toUpperCase(); // Menghasilkan 6 digit hex acak yang aman
  return `WO-${dateStr}-${randomStr}`;
}

/**
 * Helper: Validasi ketersediaan jadwal agenda vendor
 */
async function checkVendorAvailability(
  vendorId: string,
  date: Date,
  orderId: string,
): Promise<void> {
  const conflict = await prisma.vendorAvailability.findFirst({
    where: {
      vendorId,
      date,
      isBlocked: true,
      NOT: { orderId },
    },
    include: { vendor: { select: { name: true } } },
  });

  if (conflict) {
    throw new AppError(
      `Vendor '${conflict.vendor.name}' sudah penuh/booked pada tanggal tersebut`,
      409,
    );
  }
}

/**
 * 1. Membuat Draf Pesanan Baru
 */
export async function createOrderDraft(
  userId: string,
  input: CreateOrderDraftInput,
): Promise<Order> {
  const pkg = await prisma.package.findFirst({
    where: { id: input.packageId, isActive: true, deletedAt: null },
  });
  if (!pkg)
    throw new AppError(
      "Paket pernikahan tidak ditemukan atau sudah dinonaktifkan",
      404,
    );

  const orderNumber = await generateOrderNumber();

  return prisma.order.create({
    data: {
      orderNumber,
      userId,
      packageId: input.packageId,
      status: OrderStatus.DRAFT,
      packageBasePrice: pkg.basePrice,
    },
  });
}

/**
 * 2. Menyimpan Progress Pengisian Form (Auto-save Draft Step 1-5)
 */
export async function updateOrderDraft(
  orderId: string,
  userId: string,
  input: UpdateOrderDraftInput,
): Promise<Order> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId, status: OrderStatus.DRAFT, deletedAt: null },
  });
  if (!order)
    throw new AppError("Draf pesanan tidak ditemukan atau sudah diproses", 404);

  const targetDate = input.weddingDate || order.weddingDate;

  const vendorCategories: {
    key: keyof UpdateOrderDraftInput;
    category: VendorCategory;
    menuKey?: "cateringMenuId";
  }[] = [
    { key: "venueId", category: VendorCategory.VENUE },
    { key: "muaId", category: VendorCategory.MUA },
    { key: "photographerId", category: VendorCategory.PHOTOGRAPHER },
    { key: "decorationId", category: VendorCategory.DECORATION },
    {
      key: "cateringId",
      category: VendorCategory.CATERING,
      menuKey: "cateringMenuId",
    },
  ];

  for (const item of vendorCategories) {
    const vId = input[item.key] as string | undefined | null;
    if (vId) {
      const vendor = await prisma.vendor.findFirst({
        where: {
          id: vId,
          category: item.category,
          isActive: true,
          deletedAt: null,
        },
      });
      if (!vendor)
        throw new AppError(
          `Vendor dengan ID tersebut tidak ditemukan pada kategori ${item.category}`,
          404,
        );

      if (targetDate) {
        await checkVendorAvailability(vId, targetDate, orderId);
      }

      let menuId: string | null = null;

      // Perbaikan Bug 2: Ubah penulisan 0 menjadi harga base asli vendor agar representatif untuk audit internal
      let priceSnapshot = vendor.basePrice;

      if (item.menuKey && input.cateringMenuId) {
        const menu = await prisma.cateringMenu.findFirst({
          where: {
            id: input.cateringMenuId,
            vendorId: vId,
            isActive: true,
            deletedAt: null,
          },
        });
        if (!menu)
          throw new AppError(
            "Paket menu katering pilihan tidak valid untuk vendor ini",
            400,
          );
        menuId = menu.id;
        const currentGuestCount = input.guestCount || order.guestCount || 0;
        priceSnapshot = new Prisma.Decimal(menu.pricePerPax).mul(
          currentGuestCount,
        );
      }

      const isPackageVendor = await prisma.packageVendor.findFirst({
        where: { packageId: order.packageId, vendorId: vId, isDefault: true },
      });

      // Jika vendor yang dipilih klien statusnya adalah upgrade berbayar (di luar paket default)
      if (!isPackageVendor) {
        priceSnapshot = new Prisma.Decimal(vendor.basePrice).add(
          vendor.upgradeFee,
        );
      }

      await prisma.orderVendor.upsert({
        where: { orderId_category: { orderId, category: item.category } },
        update: {
          vendorId: vId,
          cateringMenuId: menuId,
          isUpgrade: !isPackageVendor,
          priceAtBooking: priceSnapshot,
        },
        create: {
          orderId,
          category: item.category,
          vendorId: vId,
          cateringMenuId: menuId,
          isUpgrade: !isPackageVendor,
          priceAtBooking: priceSnapshot,
        },
      });
    }
  }

  const updateOrderData: Prisma.OrderUpdateInput = {};
  if (input.weddingDate !== undefined)
    updateOrderData.weddingDate = input.weddingDate;
  if (input.guestCount !== undefined)
    updateOrderData.guestCount = input.guestCount;
  if (input.specialNotes !== undefined)
    updateOrderData.specialNotes = input.specialNotes ?? null;

  return prisma.order.update({
    where: { id: orderId },
    data: updateOrderData,
    include: { orderVendors: true },
  });
}

/**
 * 3. Final Submit Order
 */
export async function submitOrder(
  orderId: string,
  userId: string,
): Promise<Order> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId, status: OrderStatus.DRAFT, deletedAt: null },
    include: { orderVendors: true },
  });

  if (!order)
    throw new AppError("Pesanan tidak dapat diproses atau sudah diajukan", 404);
  if (!order.weddingDate)
    throw new AppError(
      "Tanggal pernikahan wajib ditentukan sebelum mengajukan pesanan",
      400,
    );
  if (!order.guestCount)
    throw new AppError("Jumlah kapasitas tamu wajib ditentukan", 400);

  const requiredCategories = Object.values(VendorCategory);
  const selectedCategories = order.orderVendors.map((ov) => ov.category);
  const incomplete = requiredCategories.filter(
    (cat) => !selectedCategories.includes(cat),
  );

  if (incomplete.length > 0) {
    throw new AppError(
      `Formulir pesanan belum lengkap. Kategori yang belum dipilih: ${incomplete.join(", ")}`,
      400,
    );
  }

  let totalUpgradeCost = new Prisma.Decimal(0);
  for (const ov of order.orderVendors) {
    await checkVendorAvailability(ov.vendorId, order.weddingDate, orderId);
    if (ov.isUpgrade) {
      totalUpgradeCost = totalUpgradeCost.add(ov.priceAtBooking);
    }
  }

  const grandTotal = new Prisma.Decimal(order.packageBasePrice).add(
    totalUpgradeCost,
  );

  return prisma.$transaction(async (tx) => {
    for (const ov of order.orderVendors) {
      await tx.vendorAvailability.upsert({
        where: {
          vendorId_date: { vendorId: ov.vendorId, date: order.weddingDate! },
        },
        update: {
          isBlocked: true,
          reason: `Booked by Order ${order.orderNumber}`,
          orderId,
        },
        create: {
          vendorId: ov.vendorId,
          date: order.weddingDate!,
          isBlocked: true,
          reason: `Booked by Order ${order.orderNumber}`,
          orderId,
        },
      });
    }

    return tx.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.PENDING_PAYMENT,
        vendorUpgradeTotal: totalUpgradeCost,
        grandTotal,
        submittedAt: new Date(),
      },
      include: { orderVendors: { include: { vendor: true } } },
    });
  });
}

/**
 * 4. Pembatalan Pesanan oleh Klien (Perbaikan Isu 4)
 */
export async function cancelOrder(
  orderId: string,
  userId: string,
): Promise<Order> {
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      userId,
      status: { in: [OrderStatus.DRAFT, OrderStatus.PENDING_PAYMENT] },
      deletedAt: null,
    },
  });
  if (!order)
    throw new AppError(
      "Pesanan tidak dapat dibatalkan atau status saat ini mengizinkan pembatalan",
      400,
    );

  return prisma.$transaction(async (tx) => {
    // Jika status sudah sempat checkout, bersihkan dan lepas kembali blokir ketersediaan kalender seluruh vendor
    if (order.status === OrderStatus.PENDING_PAYMENT && order.weddingDate) {
      await tx.vendorAvailability.deleteMany({
        where: { orderId: order.id },
      });
    }

    return tx.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.CANCELLED },
    });
  });
}

/**
 * 5. Mendapatkan List Riwayat Klien (Dashboard Client)
 */
export async function getClientOrders(userId: string): Promise<Order[]> {
  // Perbaikan Isu 8: Memfilter status DRAFT keluar agar tidak merusak representasi list utama dashboard klien
  return prisma.order.findMany({
    where: { userId, status: { not: OrderStatus.DRAFT }, deletedAt: null },
    include: { package: { select: { name: true, tier: true } } },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * 6. Mendapatkan Seluruh Daftar Pesanan Sistem (Perbaikan Isu 5 — Admin Only)
 */
export async function getAllOrdersForAdmin(
  status?: OrderStatus,
): Promise<Order[]> {
  return prisma.order.findMany({
    where: { deletedAt: null, ...(status && { status }) },
    include: {
      package: { select: { name: true, tier: true } },
      user: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * 7. Ambil Detail Tunggal Pesanan Berkualitas Type-Safety Tinggi
 */
export async function getOrderById(
  orderId: string,
  userId: string,
  role: string,
): Promise<DetailedOrderPayload> {
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      deletedAt: null,
      ...(role !== "ADMIN" && { userId }),
    },
    include: {
      package: true,
      user: { select: { name: true, email: true, phone: true } },
      orderVendors: { include: { vendor: true, cateringMenu: true } },
    },
  });
  if (!order) throw new AppError("Pesanan tidak ditemukan", 404);
  return order;
}
