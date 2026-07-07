import { CorsOptions } from "cors";
import { env } from "./env";

const allowedOrigins = [
  env.frontendUrl,
  // Tambahkan origin lain jika ada (staging, mobile preview, dll)
];

export const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // Izinkan request tanpa origin (mis: Postman, curl, server-to-server)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: Origin tidak diizinkan — ${origin}`));
    }
  },
  credentials: true, // Izinkan cookie/Authorization header
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  exposedHeaders: ["X-Total-Count"], // Untuk pagination header
};
