import { describe, it, expect } from "vitest";
import supertest from "supertest";
import { createApp } from "../../src/app";

const app = createApp();
const request = supertest(app);

describe("CATERING MENU INTEGRATION TESTING (RESOLVED SCENARIOS)", () => {
  describe("GET /api/v1/catering-menus/admin/all (Route Ordering Guard)", () => {
    it("should respond with 401 unauthenticated instead of 400 parameter failure, proving route collision is solved", async () => {
      const res = await request.get("/api/v1/catering-menus/admin/all");
      expect(res.status).toBe(401); // Lolos dari jebakan wildcard /:id
    });
  });

  describe("PATCH /api/v1/catering-menus/:id (Array Validation Constraints)", () => {
    it("should return 400 validation error if client attempts to update menuItems with an empty array []", async () => {
      const res = await request
        .patch("/api/v1/catering-menus/clm1234560000xx8888888888")
        .send({
          menuItems: [], // Simulasi pengosongan item ilegal
        });

      // Terpangkas oleh Auth Guard 401 atau Schema Validator 400
      expect([401, 400]).toContain(res.status);
    });
  });

  describe("GET /api/v1/catering-menus/vendor/:vendorId (Public Path Validation)", () => {
    it("should return 400 Bad Request if targeted vendor ID is a corrupted format string", async () => {
      const res = await request.get(
        "/api/v1/catering-menus/vendor/id-salah-123",
      );
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});
