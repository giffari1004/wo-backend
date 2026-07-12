import { prisma } from "../../config/database";
import { OrderStatus } from "@prisma/client";
import type {
  CalendarQuery,
  DayParam,
  ConflictsQuery,
} from "./admin-calendar.schema";

// ============================================================================
// ADMIN CALENDAR SERVICE
// ============================================================================

// PRD 4.2.5: kalender membedakan acara "pending" dan "confirmed".
// pending   → order sudah masuk kalender (weddingDate terisi) tapi DP belum
//             confirmed — masih rawan batal / berubah tanggal
// confirmed → DP sudah confirmed, secara operasional dianggap "fix"
const PENDING_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING_PAYMENT,
  OrderStatus.DP_REVIEW,
];
const CONFIRMED_STATUSES: OrderStatus[] = [
  OrderStatus.IN_PREPARATION,
  OrderStatus.FULLY_PAID,
  OrderStatus.COMPLETED,
];
// DRAFT (belum submit, weddingDate mungkin belum final) dan CANCELLED (batal)
// SENGAJA tidak ditampilkan di kalender sama sekali — bukan acara yang nyata.
const CALENDAR_RELEVANT_STATUSES: OrderStatus[] = [
  ...PENDING_STATUSES,
  ...CONFIRMED_STATUSES,
];

function getBucket(status: OrderStatus): "pending" | "confirmed" {
  return PENDING_STATUSES.includes(status) ? "pending" : "confirmed";
}

function parseMonthRange(month: string): { start: Date; end: Date } {
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1; // Date bulan 0-based

  const start = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
  // Hari ke-0 bulan berikutnya = hari terakhir bulan ini
  const end = new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999));

  return { start, end };
}

/**
 * 1. Kalender bulan — daftar order dengan weddingDate di bulan tsb,
 *    dikelompokkan pending vs confirmed, + deteksi konflik di rentang bulan
 *    itu (PRD 4.2.5)
 */
export async function getCalendarMonth(query: CalendarQuery) {
  const { start, end } = parseMonthRange(query.month);

  const orders = await prisma.order.findMany({
    where: {
      deletedAt: null,
      weddingDate: { gte: start, lte: end },
      status: { in: CALENDAR_RELEVANT_STATUSES },
    },
    select: {
      id: true,
      orderNumber: true,
      weddingDate: true,
      status: true,
      user: { select: { name: true } },
      package: { select: { name: true, tier: true } },
    },
    orderBy: { weddingDate: "asc" },
  });

  const events = orders.map((order) => ({
    ...order,
    bucket: getBucket(order.status),
  }));

  const conflicts = await detectConflicts(start, end);

  return { events, conflicts };
}

/**
 * 2. Agenda detail 1 tanggal — semua order + vendor terpilih pada tanggal itu
 *    (PRD 4.2.5: "agenda detail per client ketika tanggal tertentu dipilih")
 */
export async function getDayAgenda(param: DayParam) {
  const date = new Date(`${param.date}T00:00:00.000Z`);

  const orders = await prisma.order.findMany({
    where: {
      deletedAt: null,
      weddingDate: date,
      status: { in: CALENDAR_RELEVANT_STATUSES },
    },
    include: {
      user: { select: { name: true, email: true, phone: true } },
      package: { select: { name: true, tier: true } },
      orderVendors: {
        include: { vendor: true, cateringMenu: true },
        orderBy: { category: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return orders.map((order) => ({ ...order, bucket: getBucket(order.status) }));
}

/**
 * Deteksi konflik penjadwalan — vendor yang sama dipakai >1 order aktif di
 * tanggal yang sama (PRD 4.2.5 & 5.6.5: "peringatan apabila terdeteksi
 * konflik penjadwalan (vendor atau gedung yang sama digunakan pada tanggal
 * yang sama)").
 *
 * 🔴 PENTING SOAL DESAIN: fungsi ini SENGAJA cross-check langsung dari
 * OrderVendor + Order.weddingDate (sumber kebenaran "vendor mana dipakai
 * order mana, di tanggal berapa"), BUKAN dari tabel VendorAvailability.
 * Kenapa: VendorAvailability punya unique constraint (vendorId, date) yang
 * secara struktural TIDAK BISA menyimpan dua blok konflik sekaligus — kalau
 * dua order berebut vendor+tanggal yang sama, mekanisme di
 * order-vendor.service.ts/reschedule-request.service.ts sudah mencegahnya
 * dari awal (409 error). Jadi kalau deteksi konflik ini dibaca dari
 * VendorAvailability, ia TIDAK AKAN PERNAH menemukan apa pun — bukan karena
 * sistemnya sempurna, tapi karena tabelnya secara desain tidak bisa
 * merepresentasikan konflik.
 *
 * Query ini jadi jaring pengaman INDEPENDEN dari mekanisme pencegahan utama:
 * kalau ada bug, race condition yang lolos, atau data lama dari sebelum
 * mekanisme availability-locking diterapkan, ini yang akan mengungkapnya.
 */
async function detectConflicts(dateFrom?: Date, dateTo?: Date) {
  const orderVendors = await prisma.orderVendor.findMany({
    where: {
      order: {
        deletedAt: null,
        status: { in: CALENDAR_RELEVANT_STATUSES },
        weddingDate: {
          not: null,
          ...(dateFrom && { gte: dateFrom }),
          ...(dateTo && { lte: dateTo }),
        },
      },
    },
    select: {
      vendorId: true,
      vendor: { select: { name: true, category: true } },
      order: {
        select: {
          id: true,
          orderNumber: true,
          weddingDate: true,
          user: { select: { name: true } },
        },
      },
    },
  });

  // Kelompokkan per (vendorId + tanggal); flag grup yang dipakai >1 order berbeda
  const groups = new Map<string, typeof orderVendors>();
  for (const ov of orderVendors) {
    const dateKey = ov.order.weddingDate!.toISOString().slice(0, 10);
    const key = `${ov.vendorId}_${dateKey}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(ov);
  }

  const conflicts: Array<{
    vendorId: string;
    vendorName: string;
    vendorCategory: string;
    date: Date;
    conflictingOrders: {
      orderId: string;
      orderNumber: string;
      clientName: string;
    }[];
  }> = [];

  for (const group of groups.values()) {
    const distinctOrderIds = new Set(group.map((g) => g.order.id));
    if (distinctOrderIds.size <= 1) continue;

    // 🔴 FIX: `group[0]` selalu bertipe `T | undefined` bagi TypeScript
    // (index access tidak bisa dibuktikan aman secara statis, walau kita
    // tahu `group` tidak mungkin kosong di titik ini — cuma ditambahkan ke
    // `groups` map setelah minimal 1 kali `push`). Destructure ke variabel
    // lokal + guard eksplisit, supaya TS bisa menyempitkan (narrow) tipenya
    // jadi non-undefined untuk sisa blok ini.
    const [first] = group;
    if (!first) continue;

    conflicts.push({
      vendorId: first.vendorId,
      vendorName: first.vendor.name,
      vendorCategory: first.vendor.category,
      date: first.order.weddingDate!,
      conflictingOrders: Array.from(distinctOrderIds).map((orderId) => {
        const match = group.find((g) => g.order.id === orderId)!;
        return {
          orderId: match.order.id,
          orderNumber: match.order.orderNumber,
          clientName: match.order.user.name,
        };
      }),
    });
  }

  return conflicts;
}

/**
 * 3. Endpoint khusus daftar semua konflik, tidak terikat 1 bulan tertentu —
 *    default cuma cek ke depan (weddingDate >= hari ini) supaya tetap
 *    relevan secara operasional, kecuali admin eksplisit kasih rentang lain.
 */
export async function getConflicts(query: ConflictsQuery) {
  const dateFrom = query.dateFrom ?? new Date();
  const dateTo = query.dateTo;
  return detectConflicts(dateFrom, dateTo);
}
