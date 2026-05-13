import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { verifyAccessToken } from "./tokens";

export type AuthedUser = NonNullable<Awaited<ReturnType<typeof loadAuthedUser>>>;

async function loadAuthedUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  const { password: _password, ...safe } = user;
  return safe;
}

export async function requireBearer(req: NextRequest): Promise<
  { ok: true; user: AuthedUser } | { ok: false; reason: "missing" | "invalid" | "no_user" }
> {
  const header = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!header || !header.toLowerCase().startsWith("bearer ")) {
    return { ok: false, reason: "missing" };
  }
  const token = header.slice("bearer ".length).trim();
  const payload = await verifyAccessToken(token);
  if (!payload) return { ok: false, reason: "invalid" };

  const user = await loadAuthedUser(payload.userId);
  if (!user) return { ok: false, reason: "no_user" };

  return { ok: true, user };
}

export function isAdminRole(role: string): boolean {
  return role === "superadmin" || role === "core_member";
}
