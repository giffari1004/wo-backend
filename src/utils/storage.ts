import { supabase } from "../config/supabase";
import { env } from "../config/env";

export type StorageBucket =
  | typeof env.supabaseBucketPaymentProof
  | typeof env.supabaseBucketVendorPortfolio;

/**
 * Upload file ke Supabase Storage
 * @returns URL publik file yang diupload
 */
export async function uploadFile(
  bucket: StorageBucket,
  filePath: string, // path di dalam bucket, mis: "orders/ORD-001/bukti-dp.jpg"
  fileBuffer: Buffer,
  mimeType: string,
): Promise<string> {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(filePath, fileBuffer, {
      contentType: mimeType,
      upsert: true,
    });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return data.publicUrl;
}

/**
 * Hapus file dari Supabase Storage
 */
export async function deleteFile(
  bucket: StorageBucket,
  filePath: string,
): Promise<void> {
  const { error } = await supabase.storage.from(bucket).remove([filePath]);
  if (error) throw new Error(`Storage delete failed: ${error.message}`);
}
