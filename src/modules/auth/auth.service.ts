import bcrypt from "bcrypt";
import crypto from "crypto";
import type {
  RegisterInput,
  LoginInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  ChangePasswordInput,
} from "./auth.schema";
import { prisma } from "@/config/database";
import { signToken } from "@/middlewares/auth.middleware";
import { AppError } from "@/middlewares/error.middleware";
import { sendPasswordResetEmail, sendWelcomeEmail } from "@/config/mailer";

// ============================================================================
// AUTH SERVICE
// Seluruh business logic auth ada di sini — controller hanya memanggil
// service dan meneruskan hasilnya ke response. Pola ini memudahkan testing
// (service bisa di-test tanpa Express request/response object).
// ============================================================================

const SALT_ROUNDS = 12;
const RESET_TOKEN_EXPIRY_HOURS = 1;

// ── Tipe return ───────────────────────────────────────────────────────────────

// Field yang aman untuk dikembalikan ke client (tanpa password & deletedAt)
export type SafeUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "CLIENT" | "ADMIN";
  emailVerified: boolean;
  avatarUrl: string | null;
  createdAt: Date;
};

export type AuthResult = {
  user: SafeUser;
  token: string;
};

// ── Helper: strip field sensitif dari object User ─────────────────────────────

function sanitizeUser(user: {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "CLIENT" | "ADMIN";
  emailVerified: boolean;
  avatarUrl: string | null;
  createdAt: Date;
  password?: string;
  deletedAt?: Date | null;
  updatedAt?: Date;
}): SafeUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    emailVerified: user.emailVerified,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
  };
}

// ── Register ──────────────────────────────────────────────────────────────────

export async function register(input: RegisterInput): Promise<AuthResult> {
  const { name, email, phone, password } = input;

  // Cek duplikasi email dan phone dalam satu query menggunakan OR
  // supaya bisa memberikan pesan error yang spesifik
  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ email }, { phone }],
      deletedAt: null,
    },
    select: { email: true, phone: true },
  });

  if (existing) {
    if (existing.email === email) {
      throw new AppError("Email sudah terdaftar", 409);
    }
    throw new AppError("Nomor HP sudah terdaftar", 409);
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      phone,
      password: hashedPassword,
      role: "CLIENT", // register selalu sebagai CLIENT
    },
  });

  // Kirim welcome email secara fire-and-forget
  // Error email tidak boleh menggagalkan proses register
  sendWelcomeEmail({ to: user.email, name: user.name }).catch(() => {});

  const token = signToken({ sub: user.id, email: user.email, role: user.role });

  return { user: sanitizeUser(user), token };
}

// ── Login ─────────────────────────────────────────────────────────────────────

export async function login(input: LoginInput): Promise<AuthResult> {
  const { email, password } = input;

  const user = await prisma.user.findFirst({
    where: { email, deletedAt: null },
  });

  // Selalu jalankan bcrypt.compare meskipun user tidak ditemukan
  // untuk mencegah timing attack (attacker bisa tahu email terdaftar
  // atau tidak dari perbedaan waktu response)
  const passwordToCompare =
    user?.password ?? "$2b$12$invalidhashfortimingattack";
  const isMatch = await bcrypt.compare(password, passwordToCompare);

  if (!user || !isMatch) {
    throw new AppError("Email atau password salah", 401);
  }

  const token = signToken({ sub: user.id, email: user.email, role: user.role });

  return { user: sanitizeUser(user), token };
}

// ── Get Profile (me) ──────────────────────────────────────────────────────────

export async function getMe(userId: string): Promise<SafeUser> {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
  });

  if (!user) throw new AppError("User tidak ditemukan", 404);

  return sanitizeUser(user);
}

// ── Forgot Password ───────────────────────────────────────────────────────────

export async function forgotPassword(
  input: ForgotPasswordInput,
): Promise<void> {
  const { email } = input;

  const user = await prisma.user.findFirst({
    where: { email, deletedAt: null },
    select: { id: true, name: true, email: true },
  });

  // Jangan beritahu apakah email terdaftar atau tidak
  // Response selalu sama untuk mencegah user enumeration attack
  if (!user) return;

  // Hapus token lama yang belum dipakai milik user ini
  await prisma.passwordResetToken.deleteMany({
    where: { userId: user.id, usedAt: null },
  });

  // Generate token random yang kriptografis
  const rawToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(
    Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000,
  );

  await prisma.passwordResetToken.create({
    data: {
      token: rawToken,
      userId: user.id,
      expiresAt,
    },
  });

  await sendPasswordResetEmail({
    to: user.email,
    name: user.name,
    token: rawToken,
    expiresInHours: RESET_TOKEN_EXPIRY_HOURS,
  });
}

// ── Reset Password ────────────────────────────────────────────────────────────

export async function resetPassword(input: ResetPasswordInput): Promise<void> {
  const { token, password } = input;

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: { user: { select: { id: true, deletedAt: true } } },
  });

  // Validasi: token harus ada, belum dipakai, belum expired, dan user masih aktif
  if (
    !resetToken ||
    resetToken.usedAt !== null ||
    resetToken.expiresAt < new Date() ||
    resetToken.user.deletedAt !== null
  ) {
    throw new AppError("Token tidak valid atau sudah expired", 400);
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  // Update password dan tandai token sebagai sudah dipakai dalam satu transaction
  // supaya keduanya berhasil atau gagal bersamaan — tidak ada kondisi
  // password berubah tapi token belum ditandai usedAt atau sebaliknya
  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { password: hashedPassword },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    }),
  ]);
}

// ── Change Password ───────────────────────────────────────────────────────────

export async function changePassword(
  userId: string,
  input: ChangePasswordInput,
): Promise<void> {
  const { currentPassword, newPassword } = input;

  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { id: true, password: true },
  });

  if (!user) throw new AppError("User tidak ditemukan", 404);

  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) {
    throw new AppError("Password saat ini tidak sesuai", 400);
  }

  const hashedNewPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedNewPassword },
  });
}

// ── Delete Account (soft delete) ──────────────────────────────────────────────

export async function deleteAccount(userId: string): Promise<void> {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
  });

  if (!user) throw new AppError("User tidak ditemukan", 404);

  // Soft delete sesuai konvensi schema
  // Data historis (order, payment, dll) tetap utuh
  await prisma.user.update({
    where: { id: userId },
    data: { deletedAt: new Date() },
  });
}
