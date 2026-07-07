import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { UserRole } from "@prisma/client";
import { AppError } from "./error.middleware";

interface JwtPayload {
  sub: string; // user id
  email: string;
  role: UserRole;
}

function isJwtPayload(value: unknown): value is JwtPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>).sub === "string" &&
    typeof (value as Record<string, unknown>).email === "string" &&
    typeof (value as Record<string, unknown>).role === "string" &&
    Object.values(UserRole).includes(
      (value as Record<string, unknown>).role as UserRole,
    )
  );
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return next(new AppError("Token tidak ditemukan", 401));
  }

  const token = authHeader.slice(7); // potong "Bearer " (7 karakter), hasil selalu string

  try {
    const decoded: unknown = jwt.verify(token, env.jwtSecret);

    if (!isJwtPayload(decoded)) {
      return next(new AppError("Struktur token tidak valid", 401));
    }

    req.user = { id: decoded.sub, email: decoded.email, role: decoded.role };
    next();
  } catch {
    next(new AppError("Token tidak valid atau sudah expired", 401));
  }
}

export function authorize(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError("Tidak memiliki akses", 403));
    }
    next();
  };
}

export function signToken(payload: Omit<JwtPayload, "iat" | "exp">): string {
  const { sub, ...rest } = payload;
  const expiresIn: jwt.SignOptions["expiresIn"] =
    (env.jwtExpiresIn as jwt.SignOptions["expiresIn"]) ?? "7d";

  return jwt.sign(rest, env.jwtSecret, {
    subject: sub,
    expiresIn,
  });
}
