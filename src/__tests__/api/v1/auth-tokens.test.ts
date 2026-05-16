// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    refreshToken: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import {
  issueAccessToken,
  verifyAccessToken,
  issueRefreshToken,
  hashRefreshToken,
  rotateRefreshToken,
} from "@/lib/api/auth/tokens";
import { ApiError } from "@/lib/api/errors";

describe("auth/tokens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("access token", () => {
    it("issues a token verifiable in the same process", async () => {
      const { token, jti } = await issueAccessToken("user-1");
      const claims = await verifyAccessToken(token);
      expect(claims).not.toBeNull();
      expect(claims!.sub).toBe("user-1");
      expect(claims!.jti).toBe(jti);
    });

    it("rejects a tampered token", async () => {
      const { token } = await issueAccessToken("user-1");
      const tampered = token.slice(0, -2) + "xx";
      const claims = await verifyAccessToken(tampered);
      expect(claims).toBeNull();
    });
  });

  describe("refresh token rotation + reuse detection", () => {
    const issuedAt = new Date(Date.now() - 1000);
    const expiresAt = new Date(Date.now() + 60_000);

    it("rotates a valid token, issuing a fresh access + refresh pair", async () => {
      const fresh = issueRefreshToken();
      (prisma.refreshToken.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "rt-old",
        userId: "user-1",
        tokenHash: fresh.hash,
        familyId: "fam-1",
        replacedById: null,
        deviceId: null,
        userAgent: null,
        ip: null,
        expiresAt,
        revokedAt: null,
        reuseDetectedAt: null,
        createdAt: issuedAt,
      });
      (prisma.refreshToken.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "rt-new",
      });
      (prisma.refreshToken.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const rotated = await rotateRefreshToken(fresh.token, { ip: "1.1.1.1" });

      expect(rotated.userId).toBe("user-1");
      expect(rotated.refresh.token).not.toBe(fresh.token);
      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: "rt-old" },
        data: expect.objectContaining({ replacedById: "rt-new" }),
      });
    });

    it("revokes the entire family on reuse detection", async () => {
      const fresh = issueRefreshToken();
      (prisma.refreshToken.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "rt-old",
        userId: "user-1",
        tokenHash: fresh.hash,
        familyId: "fam-1",
        replacedById: "rt-new", // already rotated — replay
        deviceId: null,
        expiresAt,
        revokedAt: null,
        createdAt: issuedAt,
      });

      await expect(rotateRefreshToken(fresh.token, {})).rejects.toBeInstanceOf(ApiError);

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { familyId: "fam-1", revokedAt: null },
        data: expect.objectContaining({
          revokedAt: expect.any(Date),
          reuseDetectedAt: expect.any(Date),
        }),
      });
    });

    it("rejects an unknown refresh token", async () => {
      (prisma.refreshToken.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      await expect(rotateRefreshToken("nope", {})).rejects.toThrow(/invalid|expired/i);
    });

    it("rejects an expired refresh token", async () => {
      const fresh = issueRefreshToken();
      (prisma.refreshToken.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "rt-old",
        userId: "user-1",
        tokenHash: fresh.hash,
        familyId: "fam-1",
        replacedById: null,
        expiresAt: new Date(Date.now() - 1000),
        revokedAt: null,
      });
      await expect(rotateRefreshToken(fresh.token, {})).rejects.toThrow(/expired/i);
    });
  });

  describe("hashRefreshToken", () => {
    it("produces stable hashes for the same input", () => {
      expect(hashRefreshToken("abc")).toBe(hashRefreshToken("abc"));
    });
    it("produces distinct hashes for distinct inputs", () => {
      expect(hashRefreshToken("abc")).not.toBe(hashRefreshToken("abd"));
    });
  });
});
