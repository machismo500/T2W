// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the prisma client used by tokens.ts. Each test reassigns the mocks
// it cares about so we don't share state between cases.
vi.mock("@/lib/db", () => ({
  prisma: {
    refreshToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

import {
  ACCESS_TOKEN_TTL_SECONDS,
  createAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  verifyAccessToken,
} from "@/lib/api/v1/tokens";
import { prisma } from "@/lib/db";

const m = prisma.refreshToken as unknown as {
  create: ReturnType<typeof vi.fn>;
  findUnique: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  updateMany: ReturnType<typeof vi.fn>;
};

describe("api/v1 token helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = "test-secret-must-be-long-enough-for-hs256";
  });

  it("createAccessToken returns a verifiable JWT scoped to t2w-mobile", async () => {
    const token = await createAccessToken("user-1");
    expect(typeof token).toBe("string");
    expect(token.split(".").length).toBe(3);
    const verified = await verifyAccessToken(token);
    expect(verified).toEqual({ userId: "user-1" });
  });

  it("verifyAccessToken rejects garbage", async () => {
    expect(await verifyAccessToken("not.a.jwt")).toBeNull();
  });

  it("ACCESS_TOKEN_TTL_SECONDS is 15 minutes", () => {
    expect(ACCESS_TOKEN_TTL_SECONDS).toBe(15 * 60);
  });

  it("issueRefreshToken returns a base64url token and persists its hash", async () => {
    m.create.mockResolvedValue({ id: "rt-1", expiresAt: new Date(Date.now() + 1000) });
    const { token, id, expiresAt } = await issueRefreshToken({ userId: "user-1" });

    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(id).toBe("rt-1");
    expect(expiresAt).toBeInstanceOf(Date);
    expect(m.create).toHaveBeenCalledTimes(1);
    // The raw token is never written to the database.
    const args = m.create.mock.calls[0][0];
    expect(args.data.tokenHash).not.toBe(token);
    expect(args.data.tokenHash.length).toBe(64); // sha256 hex
    expect(args.data.userId).toBe("user-1");
  });

  it("rotateRefreshToken treats unknown tokens as invalid", async () => {
    m.findUnique.mockResolvedValue(null);
    const result = await rotateRefreshToken("anything");
    expect(result).toEqual({ kind: "invalid" });
  });

  it("rotateRefreshToken treats expired tokens as expired", async () => {
    m.findUnique.mockResolvedValue({
      id: "rt-1",
      userId: "user-1",
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1000),
      deviceId: null,
      platform: null,
    });
    const result = await rotateRefreshToken("present");
    expect(result).toEqual({ kind: "expired" });
  });

  it("rotateRefreshToken on a revoked token revokes ALL active sessions for the user", async () => {
    m.findUnique.mockResolvedValue({
      id: "rt-1",
      userId: "user-1",
      revokedAt: new Date(Date.now() - 5000),
      expiresAt: new Date(Date.now() + 60_000),
      deviceId: null,
      platform: null,
    });
    m.updateMany.mockResolvedValue({ count: 3 });
    const result = await rotateRefreshToken("reused");
    expect(result).toEqual({ kind: "reused", userId: "user-1" });
    expect(m.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it("rotateRefreshToken on a healthy token issues a new one and revokes the old", async () => {
    m.findUnique.mockResolvedValue({
      id: "rt-old",
      userId: "user-1",
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      deviceId: "dev-A",
      platform: "ios",
    });
    m.create.mockResolvedValue({ id: "rt-new", expiresAt: new Date(Date.now() + 1000) });
    m.update.mockResolvedValue({});

    const result = await rotateRefreshToken("good-token");
    expect(result.kind).toBe("rotated");
    expect(m.update).toHaveBeenCalledWith({
      where: { id: "rt-old" },
      data: { revokedAt: expect.any(Date), rotatedToId: "rt-new" },
    });
  });
});
