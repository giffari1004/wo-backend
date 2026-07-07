import { describe, it, expect, vi, beforeEach } from "vitest";
import supertest from "supertest";
import { createApp } from "../../src/app";

// ── Mock dependencies eksternal ───────────────────────────────────────────────
// Mock Prisma supaya test tidak butuh koneksi database nyata
vi.mock("../config/database", () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    passwordResetToken: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Mock mailer supaya test tidak kirim email sungguhan
vi.mock("../config/mailer", () => ({
  sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from "../../src/config/database";

const app = createApp();
const request = supertest(app);

// ── Register ──────────────────────────────────────────────────────────────────

describe("POST /api/v1/auth/register", () => {
  const validPayload = {
    name: "Budi Santoso",
    email: "budi@example.com",
    phone: "081234567890",
    password: "Password123",
    confirmPassword: "Password123",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("harus return 201 dan token saat input valid", async () => {
    // Arrange
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null); // tidak ada duplikasi
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: "user-123",
      name: "Budi Santoso",
      email: "budi@example.com",
      phone: "081234567890",
      role: "CLIENT",
      password: "hashed",
      emailVerified: false,
      avatarUrl: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Act
    const res = await request.post("/api/v1/auth/register").send(validPayload);

    // Assert
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("token");
    expect(res.body.data.user).not.toHaveProperty("password");
    expect(res.body.data.user.email).toBe("budi@example.com");
  });

  it("harus return 400 jika email tidak valid", async () => {
    const res = await request
      .post("/api/v1/auth/register")
      .send({ ...validPayload, email: "bukan-email" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Validasi gagal");
  });

  it("harus return 400 jika password tidak mengandung angka", async () => {
    const res = await request
      .post("/api/v1/auth/register")
      .send({
        ...validPayload,
        password: "PasswordTanpaAngka",
        confirmPassword: "PasswordTanpaAngka",
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("harus return 400 jika password dan confirmPassword tidak cocok", async () => {
    const res = await request
      .post("/api/v1/auth/register")
      .send({ ...validPayload, confirmPassword: "BedaPassword1" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("harus return 409 jika email sudah terdaftar", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      id: "user-existing",
      email: "budi@example.com",
      phone: "089999999999",
      name: "Existing",
      role: "CLIENT",
      password: "hashed",
      emailVerified: true,
      avatarUrl: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await request.post("/api/v1/auth/register").send(validPayload);

    expect(res.status).toBe(409);
    expect(res.body.message).toContain("Email");
  });
});

// ── Login ─────────────────────────────────────────────────────────────────────

describe("POST /api/v1/auth/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("harus return 200 dan token saat kredensial benar", async () => {
    const bcrypt = await import("bcrypt");
    const hashedPassword = await bcrypt.hash("Password123", 12);

    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      id: "user-123",
      name: "Budi",
      email: "budi@example.com",
      phone: "081234567890",
      role: "CLIENT",
      password: hashedPassword,
      emailVerified: true,
      avatarUrl: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await request.post("/api/v1/auth/login").send({
      email: "budi@example.com",
      password: "Password123",
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("token");
  });

  it("harus return 401 jika password salah", async () => {
    const bcrypt = await import("bcrypt");
    const hashedPassword = await bcrypt.hash("Password123", 12);

    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      id: "user-123",
      name: "Budi",
      email: "budi@example.com",
      phone: "081234567890",
      role: "CLIENT",
      password: hashedPassword,
      emailVerified: true,
      avatarUrl: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await request.post("/api/v1/auth/login").send({
      email: "budi@example.com",
      password: "PasswordSalah1",
    });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Email atau password salah");
  });

  it("harus return 401 jika email tidak ditemukan", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

    const res = await request.post("/api/v1/auth/login").send({
      email: "tidakada@example.com",
      password: "Password123",
    });

    expect(res.status).toBe(401);
    // Pesan error harus sama persis dengan kasus password salah
    // untuk mencegah user enumeration attack
    expect(res.body.message).toBe("Email atau password salah");
  });
});

// ── Forgot Password ───────────────────────────────────────────────────────────

describe("POST /api/v1/auth/forgot-password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("harus selalu return 200 meskipun email tidak terdaftar", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

    const res = await request
      .post("/api/v1/auth/forgot-password")
      .send({ email: "tidakada@example.com" });

    // Response harus sama antara email terdaftar dan tidak
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("harus return 400 jika email tidak valid", async () => {
    const res = await request
      .post("/api/v1/auth/forgot-password")
      .send({ email: "bukan-email" });

    expect(res.status).toBe(400);
  });
});
