import { Request, Response, NextFunction } from "express";
import * as uploadService from "./upload.service";
import { sendSuccess, AppError } from "@/middlewares/error.middleware";
import { UploadQueryType } from "./upload.schema";

export async function uploadSingleFile(
  req: Request<any, any, any, UploadQueryType>, // Menghilangkan any di parameter ke-4
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.file) throw new AppError("Berkas file wajib dilampirkan", 400);

    const { folder } = req.query;

    const fileUrl = await uploadService.uploadSingleFile(
      req.file,
      folder,
      req.user!.id,
      req.user!.role,
    );

    sendSuccess(res, { url: fileUrl }, "Berkas berhasil diunggah");
  } catch (err) {
    next(err);
  }
}

export async function uploadMultipleFiles(
  req: Request<any, any, any, UploadQueryType>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0)
      throw new AppError("Berkas file minimal 1 harus dilampirkan", 400);

    const { folder } = req.query;

    const fileUrls = await uploadService.uploadMultipleFiles(
      files,
      folder,
      req.user!.id,
      req.user!.role,
    );

    sendSuccess(
      res,
      { urls: fileUrls },
      `${files.length} Berkas berhasil diunggah`,
    );
  } catch (err) {
    next(err);
  }
}
