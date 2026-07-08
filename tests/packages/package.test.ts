import { describe, it, expect } from "vitest";
import supertest from "supertest";
import { createApp } from "../../src/app";

const app = createApp();
const request = supertest(app);

describe("PACKAGES MODULE TESTING", () => {
  describe("GET /api/v1/packages", () => {
    it("should return 200 and return an array of active packages", async () => {
      const res = await request.get("/api/v1/packages");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe("POST /api/v1/packages (Guard Authorization)", () => {
    it("should return 401 when attempting to create package without token", async () => {
      const res = await request.post("/api/v1/packages").send({
        tier: "SILVER",
        name: "Paket Silver Test",
        basePrice: 15000000,
        guestCapacity: 200,
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });
});
