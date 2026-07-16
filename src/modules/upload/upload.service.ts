import { uploadFile, deleteFile } from "@/utils/storage";
import { env } from "@/config/env";
import { AppError } from "@/middlewares/error.middleware";
import { UserRole } from "@prisma/client";

// Perkiraan penambahan nama env baru di config: env.supabaseBucketAvatars
function getBucketName(folder: string): string {
  if (folder === "avatars")
    return process.env.SUPABASE_BUCKET_AVATARS ?? "client-avatars";
  return env.supabaseBucketVendorPortfolio;
}

function generateFilePath(
  folder: string,
  userId: string,
  originalName: string,
): string {
  const cleanName = originalName.replace(/[^a-zA-Z0-9.]/g, "_");
  return `${folder}/${userId}/${Date.now()}-${cleanName}`;
}

export async function uploadSingleFile(
  file: Express.Multer.File,
  folder: "avatars" | "portfolios",
  userId: string,
  userRole: UserRole,
): Promise<string> {
  // Proteksi Role (Temuan 5)
  if (folder === "portfolios" && userRole !== UserRole.ADMIN) {
    throw new AppError(
      "Aksi ditolak. Hanya Admin yang dapat memperbarui portofolio master data",
      403,
    );
  }

  const bucket = getBucketName(folder);
  const filePath = generateFilePath(folder, userId, file.originalname);

  try {
    return await uploadFile(bucket, filePath, file.buffer, file.mimetype);
  } catch (error) {
    // Temuan 7: Kegagalan infra (Supabase down/timeout) diklasifikasikan sebagai non-operational (false) agar tercatat di pino logger
    throw new AppError(
      `Gagal mengunggah berkas ke storage: ${(error as Error).message}`,
      500,
      false,
    );
  }
}

export async function uploadMultipleFiles(
  files: Express.Multer.File[],
  folder: "avatars" | "portfolios",
  userId: string,
  userRole: UserRole,
): Promise<string[]> {
  if (folder === "portfolios" && userRole !== UserRole.ADMIN) {
    throw new AppError(
      "Aksi ditolak. Hanya Admin yang dapat mengunggah berkas portofolio",
      403,
    );
  }

  const bucket = getBucketName(folder);
  const uploadedPaths: string[] = [];
  const publicUrls: string[] = [];

  // Temuan 6 Fix: Mengganti Promise.all dengan sekuensial loop + tracker rollback untuk partial-failure
  try {
    for (const file of files) {
      const filePath = generateFilePath(folder, userId, file.originalname);
      const url = await uploadFile(
        bucket,
        filePath,
        file.buffer,
        file.mimetype,
      );

      uploadedPaths.push(filePath); // Catat path internal untuk backup cleanup jika crash belakangan
      publicUrls.push(url);
    }
    return publicUrls;
  } catch (error) {
    // MEKANISME ROLLBACK: Bersihkan file yang terlanjur terunggah jika ada satu saja file berikutnya yang gagal
    if (uploadedPaths.length > 0) {
      const cleanupPromises = uploadedPaths.map((path) =>
        deleteFile(bucket, path).catch(() => {}),
      );
      await Promise.all(cleanupPromises);
    }
    throw new AppError(
      `Gagal memproses unggah multi-berkas. Transaksi dibatalkan: ${(error as Error).message}`,
      500,
      false,
    );
  }
}
