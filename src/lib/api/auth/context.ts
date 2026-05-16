import type { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { verifyAccessToken } from "./tokens";
import { getClientIp } from "../request";

export type SafeUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  isApproved: boolean;
  avatar: string | null;
  city: string | null;
  totalKm: number;
  ridesCompleted: number;
  linkedRiderId: string | null;
};

export type AuthContext =
  | {
      user: SafeUser;
      source: "cookie" | "bearer";
      accessTokenJti?: string;
      deviceId?: string;
      requestId: string;
      ip: string;
    }
  | null;

const COOKIE_NAME = "t2w-token";

function readBearer(request: NextRequest): string | null {
  const header = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

function readCookie(request: NextRequest): string | null {
  return request.cookies.get(COOKIE_NAME)?.value ?? null;
}

async function loadUser(userId: string): Promise<SafeUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isApproved: true,
      avatar: true,
      city: true,
      totalKm: true,
      ridesCompleted: true,
      linkedRiderId: true,
    },
  });
  return user;
}

export async function getAuthContext(request: NextRequest): Promise<AuthContext> {
  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  const ip = getClientIp(request);

  // 1. Bearer access token (mobile + opt-in web)
  const bearer = readBearer(request);
  if (bearer) {
    const claims = await verifyAccessToken(bearer);
    if (claims) {
      const user = await loadUser(claims.sub);
      if (user) {
        return {
          user,
          source: "bearer",
          accessTokenJti: claims.jti,
          deviceId: claims.did,
          requestId,
          ip,
        };
      }
    }
  }

  // 2. Cookie fallback (web)
  const cookie = readCookie(request);
  if (cookie) {
    const payload = await verifyToken(cookie);
    if (payload) {
      const user = await loadUser(payload.userId);
      if (user) {
        return { user, source: "cookie", requestId, ip };
      }
    }
  }

  return null;
}

export function makeRequestMeta(request: NextRequest): { requestId: string; ip: string } {
  return {
    requestId: request.headers.get("x-request-id") ?? randomUUID(),
    ip: getClientIp(request),
  };
}
