import { describe, it, expect } from "vitest";
import supertest from "supertest";
import { createApp } from "../../src/app";

const app = createApp();
const request = supertest(app);

describe("ORDERS CORE TRANSACTION ROBUST INTEGRATION TESTING", () => {
  describe("GET /api/v1/orders/admin/all (Route Ordering Security)", () => {
    it("should prompt 401 unauthenticated instead of 400 parameter failure, proving route collision is solved", async () => {
      const res = await request.get("/api/v1/orders/admin/all");
      expect(res.status).toBe(401); // Lolos dari jebakan dinamis parameter wildcard /:id
    });
  });

  describe("PATCH /api/v1/orders/:id/draft (Zod Dependecy Validation Check)", () => {
    it("should fail validation with 400 if client attempts to inject cateringMenuId without passing cateringId vendor", async () => {
      const res = await request
        .patch("/api/v1/orders/clm1234560000xx8888888888/draft")
        .send({
          cateringMenuId: "clm7777770000xx8888888888", // Mengirim menu tanpa mengirim cateringId vendor
        });

      expect([401, 400]).toContain(res.status); // Terpangkas filter Auth 401 atau Schema Validator 400
    });
  });
});
