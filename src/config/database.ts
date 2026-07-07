import { PrismaClient } from "@prisma/client";
import { env } from "./env";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      env.nodeEnv === "development"
        ? ["query", "info", "warn", "error"]
        : ["warn", "error"],
  });

if (env.nodeEnv !== "production") {
  globalForPrisma.prisma = prisma;
}
