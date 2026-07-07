import "dotenv/config";
import { prisma } from "../src/config/database";
import { afterAll } from "vitest";

afterAll(async () => {
  await prisma.$disconnect();
});
