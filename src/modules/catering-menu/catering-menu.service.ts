import { prisma } from "@/config/database";
import { AppError } from "@/middlewares/error.middleware";
import { CateringMenu, Prisma } from "@prisma/client";
import type {
  CreateCateringMenuInput,
  UpdateCateringMenuInput,
} from "./catering-menu.schema";

// ============================================================================
// CATERING MENU SERVICE
// ============================================================================

/**
 * Mengambil semua paket menu katering aktif milik vendor aktif (Client Side)
 */
export async function getMenusByVendor(
  vendorId: string,
): Promise<CateringMenu[]> {
  // Perbaikan Bug 2: Memastikan vendor katering berstatus aktif (isActive: true)
  const vendorExists = await prisma.vendor.findFirst({
    where: {
      id: vendorId,
      category: "CATERING",
      isActive: true,
      deletedAt: null,
    },
  });
  if (!vendorExists)
    throw new AppError(
      "Vendor katering tidak ditemukan atau sedang dinonaktifkan",
      404,
    );

  // Perbaikan Bug 1: Memfilter menu katering hanya yang berstatus aktif (isActive: true)
  return prisma.cateringMenu.findMany({
    where: { vendorId, isActive: true, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Mengambil semua daftar katering menu lintas vendor tanpa filter status (Admin Only)
 */
export async function getAllMenusForAdmin(): Promise<CateringMenu[]> {
  // Perbaikan Isu 3: Menyediakan query data global untuk dashboard admin
  return prisma.cateringMenu.findMany({
    where: { deletedAt: null },
    include: {
      vendor: {
        select: { name: true, isActive: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Mengambil detail katering menu berdasarkan ID tunggal
 */
export async function getMenuById(id: string): Promise<CateringMenu> {
  const menu = await prisma.cateringMenu.findFirst({
    where: { id, deletedAt: null },
  });
  if (!menu) throw new AppError("Paket menu katering tidak ditemukan", 404);
  return menu;
}

/**
 * Mendaftarkan menu katering baru dengan validasi anti-duplikasi nama (Admin Only)
 */
export async function createCateringMenu(
  input: CreateCateringMenuInput,
): Promise<CateringMenu> {
  const vendor = await prisma.vendor.findFirst({
    where: { id: input.vendorId, category: "CATERING", deletedAt: null },
  });
  if (!vendor)
    throw new AppError(
      "Gagal membuat menu. Vendor tidak ditemukan atau bukan kategori CATERING",
      404,
    );

  // Perbaikan Isu 4: Validasi pencegahan duplikasi nama menu di vendor yang sama
  const nameExists = await prisma.cateringMenu.findFirst({
    where: {
      vendorId: input.vendorId,
      name: { equals: input.name, mode: "insensitive" },
      deletedAt: null,
    },
  });
  if (nameExists) {
    throw new AppError(
      `Vendor ini sudah memiliki paket menu dengan nama '${input.name}'`,
      409,
    );
  }

  return prisma.cateringMenu.create({
    data: {
      vendorId: input.vendorId,
      name: input.name,
      description: input.description ?? null,
      pricePerPax: input.pricePerPax,
      menuItems: input.menuItems,
      isActive: input.isActive ?? true,
    },
  });
}

/**
 * Memperbarui data menu katering secara parsial dengan pengecekan nama (Admin Only)
 */
export async function updateCateringMenu(
  id: string,
  input: UpdateCateringMenuInput,
): Promise<CateringMenu> {
  const menu = await prisma.cateringMenu.findFirst({
    where: { id, deletedAt: null },
  });
  if (!menu) throw new AppError("Menu katering tidak ditemukan", 404);

  // Perbaikan Isu 4: Jika mengubah nama, pastikan nama baru tidak bentrok di vendor yang sama
  if (input.name && input.name.toLowerCase() !== menu.name.toLowerCase()) {
    const nameExists = await prisma.cateringMenu.findFirst({
      where: {
        vendorId: menu.vendorId,
        name: { equals: input.name, mode: "insensitive" },
        deletedAt: null,
      },
    });
    if (nameExists) {
      throw new AppError(
        `Vendor ini sudah memiliki paket menu dengan nama '${input.name}'`,
        409,
      );
    }
  }

  const updateData: Prisma.CateringMenuUpdateInput = {};
  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined)
    updateData.description = input.description;
  if (input.pricePerPax !== undefined)
    updateData.pricePerPax = input.pricePerPax;
  if (input.menuItems !== undefined) updateData.menuItems = input.menuItems;
  if (input.isActive !== undefined) updateData.isActive = input.isActive;

  return prisma.cateringMenu.update({
    where: { id },
    data: updateData,
  });
}

/**
 * Soft Delete Menu Katering dengan Proteksi Integrity Check (Admin Only)
 */
export async function deleteCateringMenu(id: string): Promise<void> {
  const menu = await prisma.cateringMenu.findFirst({
    where: { id, deletedAt: null },
  });
  if (!menu) throw new AppError("Menu katering tidak ditemukan", 404);

  const activeUsage = await prisma.orderVendor.findFirst({
    where: {
      cateringMenuId: id,
      order: {
        status: { in: ["PENDING_PAYMENT", "DP_REVIEW", "IN_PREPARATION"] },
        deletedAt: null,
      },
    },
  });

  if (activeUsage) {
    throw new AppError(
      "Menu katering tidak dapat dihapus karena masih terikat pada pesanan pernikahan klien yang aktif berjalan",
      409,
    );
  }

  await prisma.cateringMenu.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}
