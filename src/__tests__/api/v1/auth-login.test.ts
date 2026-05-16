// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createNextRequest, parseResponse } from "@/__tests__/helpers";

// Mock the database first — these are referenced transitively by the
// login handler (lookup + refresh-token persistence).
vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    refreshToken: {
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Mock bcrypt verify so we can drive the password check.
vi.mock("bcryptjs", () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn(),
  },
}));

import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { POST } from "@/app/api/v1/auth/login/route";

const mockUser = {
  id: "user-abc",
  name: "Test Rider",
  email: "rider@t2w.com",
  password: "hashed",
  role: "rider",
  isApproved: true,
  avatar: null,
  city: null,
  totalKm: 0,
  ridesCompleted: 0,
  linkedRiderId: null,
};

describe("POST /api/v1/auth/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.refreshToken.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "rt-1",
      familyId: "rt-1",
    });
    (prisma.refreshToken.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
  });

  it("returns 401 with stable error envelope on bad password", async () => {
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
    (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    const req = createNextRequest("http://localhost/api/v1/auth/login", {
      method: "POST",
      body: { email: "rider@t2w.com", password: "wrong-pass" },
    });
    const { status, data } = await parseResponse(await POST(req));

    expect(status).toBe(401);
    expect(data.error).toMatchObject({ code: "UNAUTHORIZED" });
    expect(data.requestId).toBeTypeOf("string");
  });

  it("returns 400 envelope on missing fields", async () => {
    const req = createNextRequest("http://localhost/api/v1/auth/login", {
      method: "POST",
      body: { email: "not-an-email" },
    });
    const { status, data } = await parseResponse(await POST(req));

    expect(status).toBe(400);
    expect(data.error.code).toBe("VALIDATION");
    expect(Array.isArray(data.error.details)).toBe(true);
  });

  it("issues access + refresh tokens on success", async () => {
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
    (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    const req = createNextRequest("http://localhost/api/v1/auth/login", {
      method: "POST",
      body: { email: "rider@t2w.com", password: "super-secret-12!" },
    });
    const { status, data } = await parseResponse(await POST(req));

    expect(status).toBe(200);
    expect(data.user).toMatchObject({ id: "user-abc", email: "rider@t2w.com" });
    expect(data.tokens.accessToken).toBeTypeOf("string");
    expect(data.tokens.refreshToken).toBeTypeOf("string");
    expect(data.tokens.expiresAt).toBeTypeOf("string");
    expect(data.tokens.refreshExpiresAt).toBeTypeOf("string");
    expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
  });

  it("lowercases the email before lookup (transform applied by zod schema)", async () => {
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const req = createNextRequest("http://localhost/api/v1/auth/login", {
      method: "POST",
      body: { email: "MIXED@CASE.COM", password: "anything-12345" },
    });
    await POST(req);

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: "mixed@case.com" },
    });
  });
});
