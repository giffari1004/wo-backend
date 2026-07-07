import { z } from "zod";

// ============================================================================
// AUTH SCHEMA — Zod validation schemas untuk seluruh endpoint auth
// Setiap schema di-export sebagai tipe TypeScript juga (z.infer)
// supaya bisa dipakai di service & controller tanpa duplikasi tipe
// ============================================================================

// ── Register ─────────────────────────────────────────────────────────────────

export const registerSchema = z
  .object({
    name: z
      .string({ message: "Nama wajib diisi" })
      .min(2, "Nama minimal 2 karakter")
      .max(100, "Nama maksimal 100 karakter")
      .trim(),

    email: z
      .string({ message: "Email wajib diisi" })
      .email("Format email tidak valid")
      .toLowerCase()
      .trim(),

    phone: z
      .string({ message: "Nomor HP wajib diisi" })
      .regex(
        /^(\+62|62|0)8[1-9][0-9]{6,10}$/,
        "Format nomor HP tidak valid (contoh: 081234567890)",
      ),

    password: z
      .string({ message: "Password wajib diisi" })
      .min(8, "Password minimal 8 karakter")
      .max(72, "Password maksimal 72 karakter") // bcrypt hard limit
      .regex(/[a-zA-Z]/, "Password harus mengandung minimal 1 huruf")
      .regex(/[0-9]/, "Password harus mengandung minimal 1 angka"),

    confirmPassword: z.string({
      message: "Konfirmasi password wajib diisi",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Password dan konfirmasi password tidak cocok",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;

// ── Login ─────────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z
    .string({ message: "Email wajib diisi" })
    .email("Format email tidak valid")
    .toLowerCase()
    .trim(),

  password: z.string({ message: "Password wajib diisi" }).min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;

// ── Forgot Password ───────────────────────────────────────────────────────────

export const forgotPasswordSchema = z.object({
  email: z
    .string({ message: "Email wajib diisi" })
    .email("Format email tidak valid")
    .toLowerCase()
    .trim(),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

// ── Reset Password ────────────────────────────────────────────────────────────

export const resetPasswordSchema = z
  .object({
    token: z.string({ message: "Token wajib diisi" }).min(1),

    password: z
      .string({ message: "Password baru wajib diisi" })
      .min(8, "Password minimal 8 karakter")
      .max(72, "Password maksimal 72 karakter")
      .regex(/[a-zA-Z]/, "Password harus mengandung minimal 1 huruf")
      .regex(/[0-9]/, "Password harus mengandung minimal 1 angka"),

    confirmPassword: z.string({
      message: "Konfirmasi password wajib diisi",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Password dan konfirmasi password tidak cocok",
    path: ["confirmPassword"],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

// ── Change Password (untuk user yang sudah login) ─────────────────────────────

export const changePasswordSchema = z
  .object({
    currentPassword: z.string({
      message: "Password saat ini wajib diisi",
    }),

    newPassword: z
      .string({ message: "Password baru wajib diisi" })
      .min(8, "Password minimal 8 karakter")
      .max(72, "Password maksimal 72 karakter")
      .regex(/[a-zA-Z]/, "Password harus mengandung minimal 1 huruf")
      .regex(/[0-9]/, "Password harus mengandung minimal 1 angka"),

    confirmNewPassword: z.string({
      message: "Konfirmasi password baru wajib diisi",
    }),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Password baru dan konfirmasi tidak cocok",
    path: ["confirmNewPassword"],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "Password baru tidak boleh sama dengan password saat ini",
    path: ["newPassword"],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
