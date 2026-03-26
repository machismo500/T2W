import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "./db";

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET environment variable is required in production");
  }
  return new TextEncoder().encode(secret || "t2w-fallback-secret");
}

const TOKEN_NAME = "t2w-token";
const TOKEN_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

export async function createToken(userId: string): Promise<string> {
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_MAX_AGE}s`)
    .sign(getJwtSecret());
}

export async function verifyToken(
  token: string
): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return { userId: payload.userId as string };
  } catch {
    return null;
  }
}

export async function setAuthCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(TOKEN_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: TOKEN_MAX_AGE,
    path: "/",
  });
}

export async function removeAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(TOKEN_NAME);
}

export async function getAuthToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(TOKEN_NAME)?.value ?? null;
}

export async function getCurrentUser() {
  const token = await getAuthToken();
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
  });

  if (!user) return null;

  // Auto-link to rider profile if not already linked
  let linkedRiderId = user.linkedRiderId;
  if (!linkedRiderId) {
    try {
      const matchingProfile = await prisma.riderProfile.findFirst({
        where: { email: user.email.toLowerCase().trim(), mergedIntoId: null },
      });
      if (matchingProfile) {
        linkedRiderId = matchingProfile.id;
        await prisma.user.update({
          where: { id: user.id },
          data: { linkedRiderId: matchingProfile.id },
        });
      }
    } catch {
      // RiderProfile table may not exist yet during migration
    }
  }

  const { password: _, ...userWithoutPassword } = user;
  return { ...userWithoutPassword, linkedRiderId };
}

export function requireAuth(user: unknown): asserts user is NonNullable<
  Awaited<ReturnType<typeof getCurrentUser>>
> {
  if (!user) {
    throw new Error("Unauthorized");
  }
}

