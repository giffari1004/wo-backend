import { NextFunction, Request, Response } from "express";
import { sendSuccess } from "../../middlewares/error.middleware";
import { globalSearchService } from "./search.service";
import { GlobalSearchQueryInput } from "./search.schema";

export async function globalSearchController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const query = req.query as unknown as GlobalSearchQueryInput;

    const result = await globalSearchService(query);

    sendSuccess(res, result, "Pencarian global berhasil dieksekusi");
  } catch (err) {
    next(err);
  }
}
