import { SignJWT, jwtVerify } from "jose";
import { randomBytes, createHash } from "crypto";
import { prisma } from "@/lib/db";
import { ApiError } from "../errors";

const DEV_JWT_FALLBACK = randomBytes(32).toString("hex");

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET environment variable is required in production");
  }
  // Buffer.from(...) returns a realm-stable Uint8Array — TextEncoder under
  // jsdom (vitest) produces a Uint8Array from a different realm than the
  // one `jose`'s webapi entry-point uses for instanceof checks.
  return Buffer.from(secret || DEV_JWT_FALLBACK, "utf8");
}

const ACCESS_AUDIENCE = "t2w-api";
const ACCESS_TTL_SECONDS = 15 * 60; // 15 minutes
const REFRESH_TTL_MS = 60 * 24 * 60 * 60 * 1000; // 60 days
const REFRESH_TOKEN_BYTES = 32;

export type AccessClaims = {
  sub: string; // userId
  jti: string;
  did?: string; // deviceId
  uv?: number; // user-version, reserved for forced-logout on password change
};

export type IssuedAccess = { token: string; jti: string; expiresAt: Date };
export type IssuedRefresh = { token: string; hash: string; expiresAt: Date };

function newJti(): string {
  return randomBytes(12).toString("base64url");
}

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export async function issueAccessToken(
  userId: string,
  deviceId?: string
): Promise<IssuedAccess> {
  const jti = newJti();
  const expiresAt = new Date(Date.now() + ACCESS_TTL_SECONDS * 1000);
  const token = await new SignJWT({ sub: userId, jti, did: deviceId, uv: 1 })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TTL_SECONDS}s`)
    .setAudience(ACCESS_AUDIENCE)
    .sign(getJwtSecret());
  return { token, jti, expiresAt };
}

export async function verifyAccessToken(
  token: string
): Promise<AccessClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      audience: ACCESS_AUDIENCE,
    });
    if (typeof payload.sub !== "string" || typeof payload.jti !== "string") {
      return null;
    }
    return {
      sub: payload.sub,
      jti: payload.jti,
      did: typeof payload.did === "string" ? payload.did : undefined,
      uv: typeof payload.uv === "number" ? payload.uv : undefined,
    };
  } catch {
    return null;
  }
}

export function issueRefreshToken(): { token: string; hash: string; expiresAt: Date } {
  const token = randomBytes(REFRESH_TOKEN_BYTES).toString("base64url");
  return {
    token,
    hash: sha256(token),
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
  };
}

export function hashRefreshToken(token: string): string {
  return sha256(token);
}

export type StoreRefreshInput = {
  userId: string;
  hash: string;
  expiresAt: Date;
  familyId?: string;
  deviceId?: string;
  userAgent?: string;
  ip?: string;
};

export async function storeRefreshToken(input: StoreRefreshInput): Promise<string> {
  const created = await prisma.refreshToken.create({
    data: {
      userId: input.userId,
      tokenHash: input.hash,
      expiresAt: input.expiresAt,
      familyId: input.familyId ?? "",
      deviceId: input.deviceId ?? null,
      userAgent: input.userAgent ?? null,
      ip: input.ip ?? null,
    },
  });
  // Self-rooted family: when familyId not provided, use the row id itself so
  // the first token in a chain still has a non-empty family identifier.
  if (!input.familyId) {
    await prisma.refreshToken.update({
      where: { id: created.id },
      data: { familyId: created.id },
    });
    return created.id;
  }
  return input.familyId;
}

export async function rotateRefreshToken(
  presented: string,
  meta: { userAgent?: string; ip?: string }
): Promise<{ access: IssuedAccess; refresh: IssuedRefresh; userId: string }> {
  const hash = sha256(presented);
  const existing = await prisma.refreshToken.findUnique({ where: { tokenHash: hash } });

  if (!existing) {
    throw new ApiError("REFRESH_INVALID", "Refresh token is invalid or expired");
  }

  // Reuse detection — token was already rotated. Revoke the entire family.
  if (existing.replacedById) {
    await prisma.refreshToken.updateMany({
      where: { familyId: existing.familyId, revokedAt: null },
      data: { revokedAt: new Date(), reuseDetectedAt: new Date() },
    });
    throw new ApiError(
      "REFRESH_REUSE",
      "Refresh token reuse detected — all sessions for this device family have been revoked"
    );
  }

  if (existing.revokedAt) {
    throw new ApiError("REFRESH_INVALID", "Refresh token has been revoked");
  }

  if (existing.expiresAt.getTime() < Date.now()) {
    throw new ApiError("REFRESH_INVALID", "Refresh token has expired");
  }

  // Issue replacement + chain it.
  const access = await issueAccessToken(existing.userId, existing.deviceId ?? undefined);
  const refresh = issueRefreshToken();
  const replacement = await prisma.refreshToken.create({
    data: {
      userId: existing.userId,
      tokenHash: refresh.hash,
      familyId: existing.familyId,
      deviceId: existing.deviceId,
      userAgent: meta.userAgent ?? null,
      ip: meta.ip ?? null,
      expiresAt: refresh.expiresAt,
    },
  });
  await prisma.refreshToken.update({
    where: { id: existing.id },
    data: { replacedById: replacement.id, revokedAt: new Date() },
  });

  return { access, refresh, userId: existing.userId };
}

export async function revokeRefreshToken(presented: string): Promise<void> {
  const hash = sha256(presented);
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllForUser(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export const REFRESH_COOKIE_HEADER_HINT = "Bearer access + opaque refresh";
