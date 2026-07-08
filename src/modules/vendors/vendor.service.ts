import { prisma } from "@/config/database";
import { AppError } from "@/middlewares/error.middleware";
import { Vendor, Prisma, VendorCategory } from "@prisma/client";
import type {
  CreateVendorInput,
  UpdateVendorInput,
  AddPortfolioInput,
  SetAvailabilityInput,
} from "./vendor.schema";

// ============================================================================
// VENDOR SERVICE — Logika Bisnis Master Data Vendor, Portofolio & Kalender
// ============================================================================

export type VendorWithRelations = Prisma.VendorGetPayload<{
  include: {
    portfolios: true;
    availabilities: true;
    cateringMenus: true;
  };
}>;

/**
 * Mengambil daftar vendor aktif untuk Klien dengan data relasi lengkap
 */
export async function getPublicVendors(
  category?: VendorCategory,
): Promise<VendorWithRelations[]> {
  return prisma.vendor.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      ...(category && { category }),
    },
    include: {
      portfolios: true,
      availabilities: true,
      cateringMenus: { where: { deletedAt: null } },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Mengambil semua vendor untuk kebutuhan Admin Master Dashboard
 */
export async function getAllVendorsForAdmin(
  category?: VendorCategory,
): Promise<VendorWithRelations[]> {
  return prisma.vendor.findMany({
    where: {
      deletedAt: null,
      ...(category && { category }),
    },
    include: {
      portfolios: true,
      availabilities: true,
      cateringMenus: { where: { deletedAt: null } },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Mengambil detail lengkap satu vendor berdasarkan ID
 */
export async function getVendorById(id: string): Promise<VendorWithRelations> {
  const vendor = await prisma.vendor.findFirst({
    where: { id, deletedAt: null },
    include: {
      portfolios: true,
      availabilities: true,
      cateringMenus: { where: { deletedAt: null } },
    },
  });

  if (!vendor) throw new AppError("Vendor tidak ditemukan", 404);
  return vendor;
}

/**
 * Mendaftarkan Vendor Baru (Admin Only)
 */
export async function createVendor(input: CreateVendorInput): Promise<Vendor> {
  return prisma.vendor.create({
    data: {
      category: input.category,
      name: input.name,
      description: input.description ?? null,
      basePrice: input.basePrice,
      upgradeFee: input.upgradeFee ?? 0,
      location: input.location ?? null,
      capacity: input.capacity ?? null,
      facilities: input.facilities ?? [],
      thumbnailUrl: input.thumbnailUrl ?? null,
      isActive: input.isActive ?? true,
    },
  });
}

/**
 * Memperbarui Data Master Vendor secara Parsial (Admin Only)
 */
export async function updateVendor(
  id: string,
  input: UpdateVendorInput,
): Promise<Vendor> {
  const vendor = await prisma.vendor.findFirst({
    where: { id, deletedAt: null },
  });
  if (!vendor) throw new AppError("Vendor tidak ditemukan", 404);

  const updateData: Prisma.VendorUpdateInput = {};
  if (input.category !== undefined) updateData.category = input.category;
  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined)
    updateData.description = input.description;
  if (input.basePrice !== undefined) updateData.basePrice = input.basePrice;
  if (input.upgradeFee !== undefined) updateData.upgradeFee = input.upgradeFee;
  if (input.location !== undefined) updateData.location = input.location;
  if (input.capacity !== undefined) updateData.capacity = input.capacity;
  if (input.facilities !== undefined) updateData.facilities = input.facilities;
  if (input.thumbnailUrl !== undefined)
    updateData.thumbnailUrl = input.thumbnailUrl;
  if (input.isActive !== undefined) updateData.isActive = input.isActive;

  return prisma.vendor.update({ where: { id }, data: updateData });
}

/**
 * Soft Delete Vendor dengan Proteksi Validasi Order Aktif (Admin Only)
 */
export async function deleteVendor(id: string): Promise<void> {
  const vendor = await prisma.vendor.findFirst({
    where: { id, deletedAt: null },
  });
  if (!vendor) throw new AppError("Vendor tidak ditemukan", 404);

  const activeUsage = await prisma.orderVendor.findFirst({
    where: {
      vendorId: id,
      order: {
        status: { in: ["PENDING_PAYMENT", "DP_REVIEW", "IN_PREPARATION"] },
        deletedAt: null,
      },
    },
  });

  if (activeUsage) {
    // Perbaikan Isu 4: Menggunakan status 409 Conflict secara semantik RESTful
    throw new AppError(
      "Vendor tidak dapat dihapus karena saat ini sedang digunakan dalam melayani pesanan aktif klien",
      409,
    );
  }

  await prisma.vendor.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

/**
 * Menambahkan Gambar/Video ke Portofolio Vendor
 */
export async function addVendorPortfolio(
  vendorId: string,
  input: AddPortfolioInput,
) {
  const vendor = await prisma.vendor.findFirst({
    where: { id: vendorId, deletedAt: null },
  });
  if (!vendor) throw new AppError("Vendor tidak ditemukan", 404);

  return prisma.vendorPortfolio.create({
    data: {
      vendorId,
      mediaUrl: input.mediaUrl,
      mediaType: input.mediaType ?? "image",
      caption: input.caption ?? null,
    },
  });
}

/**
 * Menghapus Item Portofolio Vendor secara Permanen
 */
export async function deleteVendorPortfolio(
  portfolioId: string,
): Promise<void> {
  const exists = await prisma.vendorPortfolio.findUnique({
    where: { id: portfolioId },
  });
  if (!exists) throw new AppError("Item portfolio tidak ditemukan", 404);

  await prisma.vendorPortfolio.delete({ where: { id: portfolioId } });
}

/**
 * Mengelola Kalender Ketersediaan Vendor (Block/Unblock Tanggal)
 */
export async function setVendorAvailability(
  vendorId: string,
  input: SetAvailabilityInput,
) {
  const vendor = await prisma.vendor.findFirst({
    where: { id: vendorId, deletedAt: null },
  });
  if (!vendor) throw new AppError("Vendor tidak ditemukan", 404);

  return prisma.vendorAvailability.upsert({
    where: {
      vendorId_date: { vendorId, date: input.date },
    },
    update: {
      isBlocked: input.isBlocked,
      reason: input.reason ?? null,
    },
    create: {
      vendorId,
      date: input.date,
      isBlocked: input.isBlocked,
      reason: input.reason ?? null,
    },
  });
}
