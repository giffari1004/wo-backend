import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";

type RequestPart = "body" | "params" | "query";

export function validate(schema: ZodSchema, part: RequestPart = "body") {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[part]);

    if (!result.success) {
      return next(result.error);
    }

    // Ganti request part dengan data yang sudah diparsed & dibersihkan Zod
    req[part] = result.data;
    next();
  };
}
