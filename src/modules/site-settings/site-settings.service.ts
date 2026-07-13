import { prisma } from "../../config/database";
import { AppError } from "../../middlewares/error.middleware";
import { PaymentAccount, SiteSetting } from "@prisma/client";
import type {
  CreateBankAccountInput,
  UpdateBankAccountInput,
  ListBankAccountsQuery,
  UpsertSiteSettingInput,
} from "./site-settings.schema";

// ============================================================================
// ADMIN SETTINGS SERVICE
// ============================================================================
//
// ⚠️ GAP YANG PERLU DIPUTUSKAN (bukan dikerjakan diam-diam di sini):
//
// 1. Client butuh tahu daftar rekening bank AKTIF supaya tahu ke mana harus
//    transfer sebelum upload bukti (payment.schema.ts mewajibkan
//    `bankAccountId` saat uploadProof) — tapi endpoint di modul INI semuanya
//    admin-only. Belum ada endpoint yang bisa diakses client untuk lihat
//    rekening aktif. Perlu ditambahkan, kemungkinan besar lebih pas di
//    modul `payments` (mis. `GET /payments/bank-accounts`, authenticated
//    biasa tanpa authorize ADMIN) daripada di sini.
//
// 2. Key seperti "terms_and_conditions"/"faq"/"company_info" di SiteSetting
//    kemungkinan besar juga perlu dibaca PUBLIK (halaman landing/FAQ, tanpa
//    login) — tapi semua endpoint di modul ini admin-only juga.
//
// Keduanya SENGAJA tidak aku putuskan sepihak di sini karena menentukan
// siapa yang boleh baca apa itu keputusan desain, bukan sekadar teknis.

// ── A. Bank Accounts (PaymentAccount) ───────────────────────────────────

export async function createBankAccount(
  input: CreateBankAccountInput,
): Promise<PaymentAccount> {
  return prisma.paymentAccount.create({ data: input });
}

export async function listBankAccounts(
  query: ListBankAccountsQuery,
): Promise<PaymentAccount[]> {
  return prisma.paymentAccount.findMany({
    where: {
      deletedAt: null,
      ...(!query.includeInactive && { isActive: true }),
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getBankAccountDetail(
  bankAccountId: string,
): Promise<PaymentAccount> {
  const account = await prisma.paymentAccount.findFirst({
    where: { id: bankAccountId, deletedAt: null },
  });
  if (!account) {
    throw new AppError("Rekening bank tidak ditemukan", 404);
  }
  return account;
}

export async function updateBankAccount(
  bankAccountId: string,
  input: UpdateBankAccountInput,
): Promise<PaymentAccount> {
  await getBankAccountDetail(bankAccountId); // pastikan ada & belum dihapus

  // 🔴 FIX exactOptionalPropertyTypes: sebelumnya `data: input` mengoper
  // seluruh objek Zod mentah-mentah — field yang optional di Zod bertipe
  // `T | undefined` (value eksplisit), sedangkan Prisma dengan
  // exactOptionalPropertyTypes cuma menerima "key ada dengan value T" ATAU
  // "key tidak ada sama sekali", bukan "key ada dengan value undefined".
  // Solusinya: conditional spread, cuma masukkan key yang benar-benar terisi.
  return prisma.paymentAccount.update({
    where: { id: bankAccountId },
    data: {
      ...(input.bankName !== undefined && { bankName: input.bankName }),
      ...(input.accountNumber !== undefined && {
        accountNumber: input.accountNumber,
      }),
      ...(input.accountHolder !== undefined && {
        accountHolder: input.accountHolder,
      }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    },
  });
}

export async function deleteBankAccount(bankAccountId: string): Promise<void> {
  await getBankAccountDetail(bankAccountId);

  // Soft delete — model PaymentAccount SENGAJA punya kolom deletedAt karena
  // rekening lama tetap harus tersimpan untuk histori Payment yang sudah ada
  // (Payment.bankAccountId merujuk ke sini, tanpa onDelete cascade). Hard
  // delete akan gagal kena FK constraint kalau rekening ini pernah dipakai
  // transaksi mana pun — jadi soft delete memang satu-satunya opsi yang benar.
  await prisma.paymentAccount.update({
    where: { id: bankAccountId },
    data: { deletedAt: new Date(), isActive: false },
  });
}

// ── B. Site Settings (key-value) ────────────────────────────────────────

export async function listSiteSettings(): Promise<SiteSetting[]> {
  return prisma.siteSetting.findMany({ orderBy: { key: "asc" } });
}

export async function getSiteSetting(key: string): Promise<SiteSetting> {
  const setting = await prisma.siteSetting.findUnique({ where: { key } });
  if (!setting) {
    throw new AppError(`Setting dengan key '${key}' tidak ditemukan`, 404);
  }
  return setting;
}

/**
 * Upsert sengaja dipilih (bukan create+update terpisah) — site setting itu
 * key-value config, alur "set nilai untuk key X" lebih natural sebagai satu
 * operasi idempotent (PUT semantics) daripada admin harus tahu dulu apakah
 * key itu sudah pernah ada sebelum submit.
 */
export async function upsertSiteSetting(
  key: string,
  input: UpsertSiteSettingInput,
): Promise<SiteSetting> {
  return prisma.siteSetting.upsert({
    where: { key },
    update: { value: input.value },
    create: { key, value: input.value },
  });
}

export async function deleteSiteSetting(key: string): Promise<void> {
  await getSiteSetting(key); // pastikan ada dulu, biar error 404 jelas (bukan Prisma P2025 mentah)
  await prisma.siteSetting.delete({ where: { key } });
}
