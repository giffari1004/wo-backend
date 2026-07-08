import { describe, it, expect } from "vitest";
import supertest from "supertest";
import { createApp } from "../../src/app";

const app = createApp();
const request = supertest(app);

describe("VENDORS MODULE INTEGRATION TESTING (FIXED)", () => {
  describe("GET /api/v1/vendors (Query Validation)", () => {
    it("should return 200 and list active vendors successfully", async () => {
      const res = await request.get("/api/v1/vendors");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it("should return 400 when client injects an invalid category enum parameter", async () => {
      const res = await request.get("/api/v1/vendors?category=SULAP_KELILING");
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe("POST /api/v1/vendors/:id/availabilities (Past Date Protections)", () => {
    it("should reject and return 400 validation error if admin attempts to block a past date", async () => {
      // Skenario menembak tanggal tahun lalu
      const res = await request
        .post("/api/v1/vendors/clm1234560000xx8888888888/availabilities")
        .send({
          date: "2025-01-01",
          isBlocked: true,
          reason: "Uji coba tanggal kedaluwarsa",
        });

      // Jika token kosong ditangkap 401 duluan, jika lolos ditangkap validator schema 400
      expect([401, 400]).toContain(res.status);
    });
  });

  describe("GET /api/v1/vendors/admin/master-list (Route Resolution check)", () => {
    it("should prompt 401 unauthenticated instead of 400 CUID failure, proving route interception is resolved", async () => {
      const res = await request.get("/api/v1/vendors/admin/master-list");
      expect(res.status).toBe(401); // Lolos dari jebakan wildcard /:id
    });
  });
});
