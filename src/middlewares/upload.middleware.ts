import multer, { FileFilterCallback } from "multer";
import { Request } from "express";
import { AppError } from "./error.middleware";

const storage = multer.memoryStorage();

function fileFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
) {
  const allowedMimeTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        "Format file tidak didukung. Gunakan JPG, PNG, WebP, atau PDF",
        400,
      ),
    );
  }
}

// Konfigurasi untuk upload bukti transfer (maks 5MB)
export const uploadPaymentProof = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single("proof");

// Konfigurasi untuk upload portfolio vendor (maks 10MB, multiple files)
export const uploadVendorPortfolio = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
}).array("portfolios", 10);
