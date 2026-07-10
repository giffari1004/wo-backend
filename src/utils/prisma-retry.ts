import { Prisma } from "@prisma/client";
import { logger } from "../config/logger";

// ============================================================================
// PRISMA SERIALIZABLE TRANSACTION RETRY WRAPPER
// ============================================================================
//
// Ketika sebuah transaksi memakai isolationLevel: "Serializable" (mis. di
// order-vendor.service.ts untuk mencegah race condition double-booking),
// Postgres SENGAJA akan menolak salah satu dari dua transaksi yang bentrok
// dengan melempar error P2034. Ini BUKAN bug aplikasi — ini mekanisme Postgres
// untuk menjaga konsistensi data saat traffic bersamaan tinggi.
//
// Perilaku yang benar: retry transaksi tsb dari awal (bukan tampilkan error
// ke user), karena percobaan kedua biasanya langsung berhasil setelah
// transaksi pemenang pertama selesai commit.

const RETRYABLE_PRISMA_CODES = new Set([
  "P2034", // Transaction failed due to a write conflict or a deadlock
]);

interface RetryOptions {
  /** Jumlah maksimal percobaan ulang (di luar percobaan pertama). Default: 3 */
  maxRetries?: number;
  /** Delay dasar (ms) sebelum percobaan pertama diulang. Default: 50ms, naik eksponensial. */
  baseDelayMs?: number;
}

function isRetryablePrismaError(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    RETRYABLE_PRISMA_CODES.has(err.code)
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Membungkus sebuah operasi Prisma (biasanya `prisma.$transaction(...)`) dengan
 * retry otomatis khusus untuk error serialization/deadlock (P2034).
 *
 * Pakai ini untuk transaksi ber-isolation level Serializable, karena konflik
 * antar transaksi bersamaan itu WAJAR terjadi di sana dan seharusnya
 * transparan bagi end-user — bukan langsung dilempar sebagai error.
 *
 * @example
 * return withSerializableRetry(() =>
 *   prisma.$transaction(
 *     async (tx) => { ... },
 *     { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
 *   ),
 * );
 */
export async function withSerializableRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const { maxRetries = 3, baseDelayMs = 50 } = options;

  let attempt = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await operation();
    } catch (err) {
      attempt += 1;

      if (!isRetryablePrismaError(err) || attempt > maxRetries) {
        throw err;
      }

      // Exponential backoff + jitter kecil, supaya dua request yang tadi
      // bentrok tidak langsung bentrok lagi di percobaan berikutnya secara serempak
      const delay = baseDelayMs * 2 ** (attempt - 1) + Math.random() * 25;

      logger.warn(
        { attempt, maxRetries, delayMs: Math.round(delay) },
        "Transaksi Serializable bentrok (P2034), mencoba ulang otomatis",
      );

      await sleep(delay);
    }
  }
}
