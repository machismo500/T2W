import { SignJWT, jwtVerify } from "jose";
import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/db";

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;            // 15 minutes
const REFRESH_TOKEN_TTL_SECONDS = 60 * 24 * 60 * 60; // 60 days
const REFRESH_TOKEN_BYTES = 48;

// Reuse the same JWT secret as the web flow so we can validate both.
const DEV_FALLBACK = randomBytes(32).toString("hex");
function jwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET environment variable is required in production");
  }
  return new TextEncoder().encode(secret || DEV_FALLBACK);
}

export type AccessTokenPayload = {
  userId: string;
  // Distinct audience so a web cookie JWT can't be replayed as a mobile bearer.
  aud: "t2w-mobile";
};

export async function createAccessToken(userId: string): Promise<string> {
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience("t2w-mobile")
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(jwtSecret());
}

export async function verifyAccessToken(token: string): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, jwtSecret(), { audience: "t2w-mobile" });
    return { userId: payload.userId as string };
  } catch {
    return null;
  }
}

function hashRefresh(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type IssueRefreshOptions = {
  userId: string;
  deviceId?: string | null;
  platform?: "ios" | "android" | null;
};

export async function issueRefreshToken({ userId, deviceId, platform }: IssueRefreshOptions) {
  const raw = randomBytes(REFRESH_TOKEN_BYTES).toString("base64url");
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);

  const record = await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashRefresh(raw),
      deviceId: deviceId ?? null,
      platform: platform ?? null,
      expiresAt,
    },
  });

  return { token: raw, id: record.id, expiresAt };
}

export async function rotateRefreshToken(rawIncoming: string) {
  const tokenHash = hashRefresh(rawIncoming);
  const existing = await prisma.refreshToken.findUnique({ where: { tokenHash } });

  if (!existing) {
    return { kind: "invalid" as const };
  }
  if (existing.expiresAt < new Date()) {
    return { kind: "expired" as const };
  }
  if (existing.revokedAt) {
    // Reuse of a revoked token — assume compromise; revoke every active session for this user.
    await prisma.refreshToken.updateMany({
      where: { userId: existing.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { kind: "reused" as const, userId: existing.userId };
  }

  const next = await issueRefreshToken({
    userId: existing.userId,
    deviceId: existing.deviceId,
    platform: (existing.platform as "ios" | "android" | null) ?? null,
  });

  await prisma.refreshToken.update({
    where: { id: existing.id },
    data: { revokedAt: new Date(), rotatedToId: next.id },
  });

  return {
    kind: "rotated" as const,
    userId: existing.userId,
    refresh: next,
  };
}

export async function revokeRefreshToken(rawIncoming: string) {
  const tokenHash = hashRefresh(rawIncoming);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllForUser(userId: string) {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS };
