import pino from "pino";
import pinoHttp from "pino-http";
import { env } from "./env";

export const logger = pino({
  level: env.nodeEnv === "production" ? "info" : "debug",
  ...(env.nodeEnv !== "production" && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:HH:MM:ss",
        ignore: "pid,hostname",
      },
    },
  }),
});

/**
 * Middleware Express untuk log setiap HTTP request/response
 * Dipasang di app.ts sebelum route definitions
 */
export const requestLogger = pinoHttp({
  logger,
  // Jangan log request ke endpoint health check — terlalu noisy
  autoLogging: {
    ignore: (req) => req.url === "/health",
  },
  customLogLevel: (_req, res) => {
    if (res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
  serializers: {
    req(req) {
      return { method: req.method, url: req.url };
    },
    res(res) {
      return { statusCode: res.statusCode };
    },
  },
});
