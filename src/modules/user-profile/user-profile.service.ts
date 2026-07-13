import { prisma } from "../../config/database";
import { AppError } from "../../middlewares/error.middleware";
import type { UpdateProfileInput } from "./user-profile.schema";

// ============================================================================
// USER PROFILE SERVICE
// ============================================================================
//
// Scope SENGAJA dibatasi ke: name, phone, avatarUrl. TIDAK termasuk:
// - password → sudah punya flow sendiri di modul auth (ganti password,
//   lupa password) — modul ini tidak menyentuhnya sama sekali.
// - email    → perubahan email idealnya memicu re-verifikasi
//   (emailVerified perlu di-reset ke false + kirim ulang email verifikasi
//   ke alamat baru). Itu keputusan desain yang lebih pas jadi flow
//   terpisah di modul auth, bukan update biasa yang bisa diam-diam
//   mengubah alamat login tanpa konfirmasi.
// - role     → hanya admin yang boleh ubah lewat modul admin terkait,
//   bukan self-service oleh user sendiri.

// Field yang aman ditampilkan ke client — SENGAJA exclude `password`
// (hash) dari select, supaya tidak pernah ke-return meski cuma internal.
const SAFE_PROFILE_FIELDS = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  emailVerified: true,
  avatarUrl: true,
  createdAt: true,
} as const;

/**
 * 1. Ambil profil milik user yang sedang login
 */
export async function getMyProfile(userId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: SAFE_PROFILE_FIELDS,
  });

  if (!user) {
    throw new AppError("Akun tidak ditemukan", 404);
  }

  return user;
}

/**
 * 2. Perbarui profil milik user yang sedang login
 */
export async function updateMyProfile(
  userId: string,
  input: UpdateProfileInput,
) {
  // Pastikan akun masih aktif (bukan yang sudah soft-deleted) sebelum update
  const existing = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
  });
  if (!existing) {
    throw new AppError("Akun tidak ditemukan", 404);
  }

  // Kalau `phone` bentrok dengan user lain, Prisma akan melempar P2002 —
  // sudah ditangani rapi oleh error.middleware global ("Data dengan phone
  // tersebut sudah terdaftar", 409) tanpa perlu pre-check manual di sini.
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.phone !== undefined && { phone: input.phone }),
      ...(input.avatarUrl !== undefined && { avatarUrl: input.avatarUrl }),
    },
    select: SAFE_PROFILE_FIELDS,
  });

  return updated;
}
