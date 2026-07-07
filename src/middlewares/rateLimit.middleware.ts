import rateLimit from "express-rate-limit";
import { env } from "../config/env";

/**
 * Rate limiter global — semua endpoint
 * Default: 100 request per 15 menit per IP
 */
export const rateLimiter = rateLimit({
  windowMs: env.rateLimitWindowMs,
  max: env.rateLimitMax,
  standardHeaders: true, // Return rate limit info di `RateLimit-*` headers
  legacyHeaders: false,
  message: {
    status: 429,
    error: "Terlalu banyak request. Coba lagi beberapa saat.",
  },
});

/**
 * Rate limiter ketat khusus untuk endpoint autentikasi
 * Mencegah brute-force attack
 * 10 request per 15 menit per IP
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    error: "Terlalu banyak percobaan login. Coba lagi dalam 15 menit.",
  },
});
