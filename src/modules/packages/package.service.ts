import { prisma } from "@/config/database";
import { AppError } from "@/middlewares/error.middleware";
import type { CreatePackageInput, UpdatePackageInput } from "./package.schema";
import { Package, Prisma } from "@prisma/client";

// ============================================================================
// PACKAGE SERVICE — Business logic terpusat untuk pengelolaan master data paket
// ============================================================================

// Eksport Type relasi gabungan yang akurat untuk type-safety layer controller/FE
export type PackageWithVendors = Prisma.PackageGetPayload<{
  include: {
    packageVendors: {
      include: {
        vendor: true;
      };
    };
  };
}>;

/**
 * Mengambil semua paket aktif untuk Client Side / Landing Page
 */
export async function getPublicPackages(): Promise<PackageWithVendors[]> {
  return prisma.package.findMany({
    where: {
      isActive: true,
      deletedAt: null,
    },
    orderBy: {
      displayOrder: "asc",
    },
    include: {
      packageVendors: {
        where: {
          vendor: {
            deletedAt: null,
            isActive: true,
          },
        },
        include: {
          vendor: true,
        },
      },
    },
  });
}

/**
 * Mengambil semua paket untuk Admin Side (termasuk yang non-aktif)
 */
export async function getAllPackagesForAdmin(): Promise<PackageWithVendors[]> {
  return prisma.package.findMany({
    where: {
      deletedAt: null,
    },
    orderBy: {
      displayOrder: "asc",
    },
    include: {
      packageVendors: {
        include: {
          vendor: true,
        },
      },
    },
  });
}

/**
 * Mengambil detail satu paket berdasarkan ID
 */
export async function getPackageById(id: string): Promise<PackageWithVendors> {
  const pkg = await prisma.package.findFirst({
    where: { id, deletedAt: null },
    include: {
      packageVendors: {
        include: {
          vendor: true,
        },
      },
    },
  });

  if (!pkg) {
    throw new AppError("Paket tidak ditemukan", 404);
  }
  return pkg;
}

/**
 * Membuat paket baru (Admin Only)
 */
export async function createPackage(
  input: CreatePackageInput,
): Promise<Package> {
  const existing = await prisma.package.findFirst({
    where: { tier: input.tier, deletedAt: null },
  });

  if (existing) {
    throw new AppError(`Paket dengan tier ${input.tier} sudah terdaftar`, 409);
  }

  return prisma.package.create({
    data: {
      tier: input.tier,
      name: input.name,
      description: input.description ?? null,
      basePrice: input.basePrice,
      guestCapacity: input.guestCapacity,
      thumbnailUrl: input.thumbnailUrl ?? null,
      isActive: input.isActive ?? true,
      displayOrder: input.displayOrder ?? 0,
    },
  });
}

/**
 * Memperbarui data paket (Admin Only)
 */
export async function updatePackage(
  id: string,
  input: UpdatePackageInput,
): Promise<Package> {
  const pkg = await prisma.package.findFirst({
    where: { id, deletedAt: null },
  });

  if (!pkg) {
    throw new AppError("Paket tidak ditemukan", 404);
  }

  if (input.tier && input.tier !== pkg.tier) {
    const existingTier = await prisma.package.findFirst({
      where: { tier: input.tier, deletedAt: null },
    });
    if (existingTier) {
      throw new AppError(
        `Paket dengan tier ${input.tier} sudah terdaftar`,
        409,
      );
    }
  }

  const updateData: Prisma.PackageUpdateInput = {};
  if (input.tier !== undefined) updateData.tier = input.tier;
  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined)
    updateData.description = input.description;
  if (input.basePrice !== undefined) updateData.basePrice = input.basePrice;
  if (input.guestCapacity !== undefined)
    updateData.guestCapacity = input.guestCapacity;
  if (input.thumbnailUrl !== undefined)
    updateData.thumbnailUrl = input.thumbnailUrl;
  if (input.isActive !== undefined) updateData.isActive = input.isActive;
  if (input.displayOrder !== undefined)
    updateData.displayOrder = input.displayOrder;

  return prisma.package.update({
    where: { id },
    data: updateData,
  });
}

/**
 * Menghapus paket secara aman (Soft Delete - Admin Only)
 */
export async function deletePackage(id: string): Promise<void> {
  const pkg = await prisma.package.findFirst({
    where: { id, deletedAt: null },
  });

  if (!pkg) {
    throw new AppError("Paket tidak ditemukan", 404);
  }

  // VALIDASI PROTEKSI: Cek apakah ada order aktif yang sedang bergantung pada paket ini
  const activeOrder = await prisma.order.findFirst({
    where: {
      packageId: id,
      status: {
        in: ["PENDING_PAYMENT", "DP_REVIEW", "IN_PREPARATION"],
      },
      deletedAt: null,
    },
  });

  if (activeOrder) {
    throw new AppError(
      "Paket tidak dapat dihapus karena masih digunakan oleh pesanan klien yang sedang aktif berjalan",
      400,
    );
  }

  await prisma.package.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}
