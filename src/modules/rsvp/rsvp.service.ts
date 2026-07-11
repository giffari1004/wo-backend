import { prisma } from "../../config/database";
import { AppError } from "../../middlewares/error.middleware";
import { env } from "../../config/env";
import * as notificationService from "../notifications/notification.service";
import {
  RsvpLink,
  RsvpSubmission,
  RsvpAttendance,
  OrderStatus,
  NotificationType,
  UserRole,
  Prisma,
} from "@prisma/client";
import type {
  CreateRsvpLinkInput,
  UpdateRsvpLinkInput,
  SubmitRsvpInput,
} from "./rsvp.schema";

// ============================================================================
// RSVP SERVICE
// ============================================================================
//
// Modul ini punya dua "wajah":
// 1. PRIVATE (butuh auth) — client (pemilik order) & admin mengelola link RSVP
//    dan melihat tracker konfirmasi tamu.
// 2. PUBLIC (tanpa auth) — tamu undangan mengakses halaman RSVP via slug link
//    dan mengisi form konfirmasi kehadiran. Endpoint ini SENGAJA tidak pernah
//    mengekspos data sensitif (userId pemilik, orderId asli, dst) — hanya info
//    yang memang untuk publik.

const MAX_SLUG_RETRIES = 5;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // buang diakritik (é, ñ, dst)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "");
}

function generateRandomSuffix(length = 6): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

/**
 * Slug dibentuk dari nama pengantin (kalau ada) + suffix random —
 * jadi enak dibaca ("dinda-farhan-x7k2p9") sekaligus tidak gampang ditebak
 * / dienumerasi orang lain, karena data RSVP tamu bersifat pribadi per client.
 */
function buildSlugCandidate(
  brideName?: string | null,
  groomName?: string | null,
): string {
  const namePart = [brideName, groomName]
    .filter((name): name is string => Boolean(name))
    .map(slugify)
    .join("-");
  const base = namePart || "rsvp";
  return `${base}-${generateRandomSuffix()}`;
}

function buildPublicUrl(slug: string): string {
  return `${env.frontendUrl}/rsvp/${slug}`;
}

/**
 * Helper ownership check — pola yang sama dipakai di order-vendor, payment,
 * invoice, dan preparation: client hanya boleh akses order miliknya sendiri,
 * admin boleh akses semua.
 */
async function findAccessibleOrder(
  orderId: string,
  userId: string,
  role: UserRole,
) {
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      deletedAt: null,
      ...(role !== UserRole.ADMIN && { userId }),
    },
  });

  if (!order) {
    throw new AppError(
      "Pesanan tidak ditemukan atau Anda tidak memiliki hak akses",
      404,
    );
  }

  return order;
}

// ============================================================================
// A. PRIVATE — dikelola client (pemilik order) & admin
// ============================================================================

/**
 * 1. Membuat / generate link RSVP untuk sebuah order.
 *    Idempotent: kalau link untuk order ini sudah ada, langsung dikembalikan
 *    (relasi Order–RsvpLink memang 1:1 di schema, `orderId` unique).
 */
export async function createRsvpLink(
  orderId: string,
  userId: string,
  role: UserRole,
  input: CreateRsvpLinkInput,
): Promise<RsvpLink & { publicUrl: string }> {
  const order = await findAccessibleOrder(orderId, userId, role);

  if (
    order.status === OrderStatus.DRAFT ||
    order.status === OrderStatus.CANCELLED
  ) {
    throw new AppError(
      "Link RSVP hanya bisa dibuat untuk pesanan yang sudah diajukan dan belum dibatalkan",
      400,
    );
  }

  const existing = await prisma.rsvpLink.findUnique({ where: { orderId } });
  if (existing) {
    return { ...existing, publicUrl: buildPublicUrl(existing.slug) };
  }

  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_SLUG_RETRIES; attempt++) {
    const slug = buildSlugCandidate(input.brideName, input.groomName);

    try {
      const link = await prisma.rsvpLink.create({
        data: {
          orderId,
          slug,
          groomName: input.groomName ?? null,
          brideName: input.brideName ?? null,
          eventInfo: input.eventInfo ?? null,
        },
      });
      return { ...link, publicUrl: buildPublicUrl(link.slug) };
    } catch (error) {
      // Collision slug (kemungkinan sangat kecil berkat random suffix, tapi
      // tetap ditangani) — coba lagi dengan suffix baru
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        lastError = error;
        continue;
      }
      throw error;
    }
  }

  throw new AppError(
    "Gagal membuat link RSVP setelah beberapa kali percobaan. Silakan coba lagi.",
    500,
    false,
  );
}

/**
 * 2. Mengambil konfigurasi link RSVP + ringkasan statistik konfirmasi tamu
 *    (dipakai untuk kartu ringkasan di dashboard client/admin)
 */
export async function getRsvpLinkByOrder(
  orderId: string,
  userId: string,
  role: UserRole,
) {
  await findAccessibleOrder(orderId, userId, role);

  const link = await prisma.rsvpLink.findUnique({ where: { orderId } });
  if (!link) {
    throw new AppError("Link RSVP belum dibuat untuk pesanan ini", 404);
  }

  const [attendingAgg, notAttendingCount] = await Promise.all([
    prisma.rsvpSubmission.aggregate({
      where: { rsvpLinkId: link.id, attendance: RsvpAttendance.ATTENDING },
      _sum: { guestCount: true },
      _count: true,
    }),
    prisma.rsvpSubmission.count({
      where: { rsvpLinkId: link.id, attendance: RsvpAttendance.NOT_ATTENDING },
    }),
  ]);

  return {
    ...link,
    publicUrl: buildPublicUrl(link.slug),
    stats: {
      totalSubmissions: attendingAgg._count + notAttendingCount,
      totalAttendingSubmissions: attendingAgg._count,
      totalAttendingGuests: attendingAgg._sum.guestCount ?? 0,
      totalNotAttending: notAttendingCount,
    },
  };
}

/**
 * 3. Memperbarui konfigurasi link RSVP (nama mempelai, detail acara, atau
 *    nonaktifkan link — mis. setelah acara selesai)
 */
export async function updateRsvpLink(
  orderId: string,
  userId: string,
  role: UserRole,
  input: UpdateRsvpLinkInput,
): Promise<RsvpLink & { publicUrl: string }> {
  await findAccessibleOrder(orderId, userId, role);

  const link = await prisma.rsvpLink.findUnique({ where: { orderId } });
  if (!link) {
    throw new AppError("Link RSVP belum dibuat untuk pesanan ini", 404);
  }

  const updated = await prisma.rsvpLink.update({
    where: { orderId },
    data: {
      ...(input.groomName !== undefined && { groomName: input.groomName }),
      ...(input.brideName !== undefined && { brideName: input.brideName }),
      ...(input.eventInfo !== undefined && { eventInfo: input.eventInfo }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    },
  });

  return { ...updated, publicUrl: buildPublicUrl(updated.slug) };
}

/**
 * 4. Tracker — daftar seluruh submission RSVP untuk satu order
 */
export async function getSubmissionsByOrder(
  orderId: string,
  userId: string,
  role: UserRole,
): Promise<RsvpSubmission[]> {
  await findAccessibleOrder(orderId, userId, role);

  const link = await prisma.rsvpLink.findUnique({ where: { orderId } });
  if (!link) {
    throw new AppError("Link RSVP belum dibuat untuk pesanan ini", 404);
  }

  return prisma.rsvpSubmission.findMany({
    where: { rsvpLinkId: link.id },
    orderBy: { submittedAt: "desc" },
  });
}

// ============================================================================
// B. PUBLIC — diakses tamu tanpa login, lewat slug link
// ============================================================================

/**
 * 5. Detail acara untuk halaman RSVP publik (PRD 5.1)
 *    Sengaja hanya me-return field yang memang untuk konsumsi publik.
 */
export async function getPublicEventDetail(slug: string) {
  const link = await prisma.rsvpLink.findFirst({
    where: { slug, isActive: true },
    include: { order: { select: { weddingDate: true } } },
  });

  // Tidak dibedakan antara "slug tidak ada" vs "link dinonaktifkan" —
  // sama-sama 404 generik, supaya tidak membocorkan status link ke pihak
  // yang sekadar menebak-nebak slug.
  if (!link) {
    throw new AppError(
      "Halaman RSVP tidak ditemukan atau sudah tidak aktif",
      404,
    );
  }

  return {
    groomName: link.groomName,
    brideName: link.brideName,
    eventInfo: link.eventInfo,
    weddingDate: link.order.weddingDate,
  };
}

/**
 * 6. Submit form RSVP dari tamu (PRD 5.2)
 */
export async function submitRsvp(
  slug: string,
  input: SubmitRsvpInput,
): Promise<RsvpSubmission> {
  const link = await prisma.rsvpLink.findFirst({
    where: { slug, isActive: true },
    include: {
      order: { select: { id: true, orderNumber: true, userId: true } },
    },
  });

  if (!link) {
    throw new AppError(
      "Halaman RSVP tidak ditemukan atau sudah tidak aktif",
      404,
    );
  }

  // Kalau tamu memilih TIDAK hadir, paksa guestCount = 0 — supaya statistik
  // total tamu hadir (dipakai WO untuk estimasi katering & kursi) tetap
  // akurat, berapa pun angka yang kebetulan masih tertinggal di form.
  const finalGuestCount =
    input.attendance === RsvpAttendance.NOT_ATTENDING ? 0 : input.guestCount;

  return prisma.$transaction(async (tx) => {
    const submission = await tx.rsvpSubmission.create({
      data: {
        rsvpLinkId: link.id,
        guestName: input.guestName,
        guestCount: finalGuestCount,
        attendance: input.attendance,
        message: input.message,
      },
    });

    await notificationService.createNotification(tx, {
      userId: link.order.userId,
      orderId: link.order.id,
      type: NotificationType.RSVP_NEW_SUBMISSION,
      title: "Konfirmasi RSVP Baru",
      message:
        input.attendance === RsvpAttendance.ATTENDING
          ? `${input.guestName} mengonfirmasi akan hadir (${finalGuestCount} orang) untuk pesanan ${link.order.orderNumber}`
          : `${input.guestName} mengonfirmasi tidak dapat hadir untuk pesanan ${link.order.orderNumber}`,
    });

    return submission;
  });
}

/**
 * 7. [OPSIONAL — PRD 5.3] Daftar ucapan/doa dari tamu yang sudah konfirmasi
 *    hadir, ditampilkan di halaman terima kasih.
 */
export async function getPublicWishes(slug: string) {
  const link = await prisma.rsvpLink.findFirst({
    where: { slug, isActive: true },
  });

  if (!link) {
    throw new AppError(
      "Halaman RSVP tidak ditemukan atau sudah tidak aktif",
      404,
    );
  }

  return prisma.rsvpSubmission.findMany({
    where: {
      rsvpLinkId: link.id,
      attendance: RsvpAttendance.ATTENDING,
      message: { not: null },
    },
    select: { guestName: true, message: true, submittedAt: true },
    orderBy: { submittedAt: "desc" },
    take: 50, // batasi payload — halaman publik, jangan sampai jadi vektor DoS kalau submission ribuan
  });
}
