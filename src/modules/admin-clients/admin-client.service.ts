import { prisma } from "../../config/database";
import { AppError } from "../../middlewares/error.middleware";
import { UserRole, OrderStatus, Prisma } from "@prisma/client";
import type { ListClientsQuery } from "./admin-client.schema";

// ============================================================================
// ADMIN CLIENT SERVICE
// ============================================================================
//
// ⚠️ CATATAN SCOPE: PRD bagian 7 ("Di Luar Lingkup MVP & Rekomendasi
// Pengembangan Lanjutan") secara eksplisit mencantumkan "Manajemen detail
// client (riwayat seluruh order per client)" sebagai fitur FASE 2, bukan
// MVP. Modul ini tetap dibangun karena ada di daftar modul kita sendiri,
// tapi ini di luar cakupan MVP resmi PRD — aman ditunda kalau prioritas
// berubah tanpa mengganggu kelengkapan MVP.
//
// Murni READ-ONLY — tidak ada mutasi data client di sini. Edit profil tetap
// hak client sendiri (modul auth/user-profile), bukan wewenang admin.

// Status order yang dihitung sebagai "belanja nyata" client — konsisten
// dengan REVENUE_BUCKET_MAP di admin-dashboard.service.ts (DRAFT & CANCELLED
// tidak dihitung, bukan komitmen finansial valid)
const REVENUE_COUNTED_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING_PAYMENT,
  OrderStatus.DP_REVIEW,
  OrderStatus.IN_PREPARATION,
  OrderStatus.FULLY_PAID,
  OrderStatus.COMPLETED,
];

/**
 * 1. Daftar seluruh client (role CLIENT) + ringkasan jumlah order
 */
export async function listClients(query: ListClientsQuery) {
  const { search, page, limit } = query;

  const where: Prisma.UserWhereInput = {
    role: UserRole.CLIENT,
    deletedAt: null,
    ...(search && {
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ],
    }),
  };

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        emailVerified: true,
        createdAt: true,
        _count: { select: { orders: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

/**
 * 2. Detail 1 client — profil + riwayat SELURUH order miliknya (PRD Fase 2)
 */
export async function getClientDetail(clientId: string) {
  const client = await prisma.user.findFirst({
    where: { id: clientId, role: UserRole.CLIENT, deletedAt: null },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      emailVerified: true,
      avatarUrl: true,
      createdAt: true,
      orders: {
        where: { deletedAt: null },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          weddingDate: true,
          grandTotal: true,
          package: { select: { name: true, tier: true } },
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!client) {
    throw new AppError("Client tidak ditemukan", 404);
  }

  // Ringkasan finansial lintas seluruh order client ini
  const totalSpent = client.orders
    .filter((order) => REVENUE_COUNTED_STATUSES.includes(order.status))
    .reduce((sum, order) => sum + Number(order.grandTotal), 0);

  return {
    ...client,
    summary: {
      totalOrders: client.orders.length,
      totalSpent,
    },
  };
}
