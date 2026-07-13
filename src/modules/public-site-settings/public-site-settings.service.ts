import { prisma } from "../../config/database";
import { AppError } from "../../middlewares/error.middleware";
import { SiteSetting } from "@prisma/client";

// ============================================================================
// PUBLIC SITE SETTINGS SERVICE
// ============================================================================
//
// 🔴 KEPUTUSAN DESAIN PENTING: SiteSetting adalah tabel key-value generik —
// admin BISA saja menyimpan config sensitif di sana suatu saat (bukan cuma
// konten publik seperti FAQ/terms). Supaya endpoint publik ini tidak diam-diam
// membocorkan key yang seharusnya admin-only, dipakai WHITELIST eksplisit di
// sini — BUKAN "semua key boleh dibaca publik kecuali di-block".
//
// Kalau nanti nambah konten publik baru (mis. "privacy_policy",
// "contact_info"), key barunya WAJIB ditambahkan ke daftar ini dulu — kalau
// tidak, endpoint publik akan selalu balas 404 untuk key itu meskipun
// datanya sudah ada di database (fail-safe: defaultnya tertutup, bukan
// terbuka).
//
// Saran jangka panjang: kalau daftar ini mulai sering berubah, pertimbangkan
// migration nambah kolom `isPublic Boolean @default(false)` di model
// SiteSetting, supaya visibilitas dikontrol dari data bukan hardcode di kode.
const PUBLIC_SITE_SETTING_KEYS = new Set([
  "terms_and_conditions",
  "faq",
  "company_info",
]);

export async function getPublicSiteSetting(key: string): Promise<SiteSetting> {
  if (!PUBLIC_SITE_SETTING_KEYS.has(key)) {
    // 404 generik, bukan 403 — supaya tidak membocorkan "key ini ada tapi
    // memang sengaja disembunyikan" ke pihak luar yang coba-coba menebak key
    throw new AppError(`Setting dengan key '${key}' tidak ditemukan`, 404);
  }

  const setting = await prisma.siteSetting.findUnique({ where: { key } });
  if (!setting) {
    throw new AppError(`Setting dengan key '${key}' tidak ditemukan`, 404);
  }

  return setting;
}

export async function listPublicSiteSettings(): Promise<SiteSetting[]> {
  return prisma.siteSetting.findMany({
    where: { key: { in: Array.from(PUBLIC_SITE_SETTING_KEYS) } },
    orderBy: { key: "asc" },
  });
}
