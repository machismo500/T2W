import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { apiError, apiOk } from "@/lib/api/v1/errors";
import { requireBearer } from "@/lib/api/v1/auth-guard";

export async function GET(req: NextRequest) {
  const auth = await requireBearer(req);
  if (!auth.ok) {
    return apiError("UNAUTHORIZED", "Authentication required");
  }

  const full = await prisma.user.findUnique({
    where: { id: auth.user.id },
    include: {
      motorcycles: true,
      earnedBadges: { include: { badge: true } },
    },
  });

  if (!full) {
    return apiError("NOT_FOUND", "User not found");
  }

  const { password: _pw, ...safe } = full;
  return apiOk({ user: safe });
}
