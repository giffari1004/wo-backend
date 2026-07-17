import { Prisma, UserRole } from "@prisma/client";
import { prisma } from "../../config/database";
import { AppError } from "../../middlewares/error.middleware";
import { GlobalSearchQueryInput } from "./search.schema";

export async function globalSearchService(query: GlobalSearchQueryInput) {
  const { q, scope, page, limit } = query;

  const skip = (page - 1) * limit;

  let orders: any[] = [];
  let clients: any[] = [];
  let vendors: any[] = [];

  let totalOrders = 0;
  let totalClients = 0;
  let totalVendors = 0;

  const searchOrders = async () => {
    const whereCondition: Prisma.OrderWhereInput = {
      deletedAt: null,
      orderNumber: {
        contains: q,
        mode: "insensitive",
      },
    };

    [orders, totalOrders] = await Promise.all([
      prisma.order.findMany({
        where: whereCondition,
        include: {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
          package: {
            select: {
              name: true,
              tier: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: {
          createdAt: "desc",
        },
      }),

      prisma.order.count({
        where: whereCondition,
      }),
    ]);
  };

  const searchClients = async () => {
    const whereCondition: Prisma.UserWhereInput = {
      role: UserRole.CLIENT,
      deletedAt: null,
      OR: [
        {
          name: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          email: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          phone: {
            contains: q,
            mode: "insensitive",
          },
        },
      ],
    };

    [clients, totalClients] = await Promise.all([
      prisma.user.findMany({
        where: whereCondition,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          createdAt: true,
        },
        skip,
        take: limit,
        orderBy: {
          createdAt: "desc",
        },
      }),

      prisma.user.count({
        where: whereCondition,
      }),
    ]);
  };

  const searchVendors = async () => {
    const whereCondition: Prisma.VendorWhereInput = {
      deletedAt: null,
      OR: [
        {
          name: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          location: {
            contains: q,
            mode: "insensitive",
          },
        },
      ],
    };

    [vendors, totalVendors] = await Promise.all([
      prisma.vendor.findMany({
        where: whereCondition,
        select: {
          id: true,
          name: true,
          category: true,
          location: true,
          thumbnailUrl: true,
          isActive: true,
        },
        skip,
        take: limit,
        orderBy: {
          createdAt: "desc",
        },
      }),

      prisma.vendor.count({
        where: whereCondition,
      }),
    ]);
  };

  try {
    const promises: Promise<void>[] = [];

    if (scope === "all" || scope === "orders") {
      promises.push(searchOrders());
    }

    if (scope === "all" || scope === "clients") {
      promises.push(searchClients());
    }

    if (scope === "all" || scope === "vendors") {
      promises.push(searchVendors());
    }

    await Promise.all(promises);

    const results: any = {};

    if (scope === "all" || scope === "orders") {
      results.orders = {
        items: orders,
        pagination: {
          page,
          limit,
          total: totalOrders,
          totalPages: Math.ceil(totalOrders / limit),
        },
      };
    }

    if (scope === "all" || scope === "clients") {
      results.clients = {
        items: clients,
        pagination: {
          page,
          limit,
          total: totalClients,
          totalPages: Math.ceil(totalClients / limit),
        },
      };
    }

    if (scope === "all" || scope === "vendors") {
      results.vendors = {
        items: vendors,
        pagination: {
          page,
          limit,
          total: totalVendors,
          totalPages: Math.ceil(totalVendors / limit),
        },
      };
    }

    return {
      query: {
        q,
        scope,
      },
      results,
    };
  } catch {
    throw new AppError(
      "Terjadi kesalahan saat memproses pencarian data, silakan coba lagi",
      500,
      false,
    );
  }
}
