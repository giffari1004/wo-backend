import "dotenv/config";
import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { prisma } from "./config/database";
import { registerJobs } from "./jobs/scheduler";

async function main() {
  // 1. Koneksi database
  await prisma.$connect();
  logger.info("✓ Database connected");

  // 2. Buat Express app
  const app = createApp();

  // 3. Registrasi scheduled jobs
  registerJobs();
  logger.info("✓ Scheduled jobs registered");

  // 4. Start server
  const server = app.listen(env.port, () => {
    logger.info(`✓ Server running → http://localhost:${env.port}`);
    logger.info(
      `✓ API docs      → http://localhost:${env.port}${env.apiPrefix}/docs`,
    );
    logger.info(`✓ Environment   → ${env.nodeEnv}`);
  });

  // 5. Graceful shutdown — tutup koneksi database saat server mati
  const shutdown = async (signal: string) => {
    logger.info(`[${signal}] Shutting down...`);
    server.close(async () => {
      await prisma.$disconnect();
      logger.info("Database disconnected. Bye.");
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("Fatal error during startup:", err);
  process.exit(1);
});
