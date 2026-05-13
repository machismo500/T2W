import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { apiError, apiOk } from "@/lib/api/v1/errors";
import { requireBearer } from "@/lib/api/v1/auth-guard";

export async function GET(req: NextRequest) {
  const auth = await requireBearer(req);
  if (!auth.ok) {
    return apiError("UNAUTHORIZED", "Authentication required");
  }

  const notifications = await prisma.notification.findMany({
    where: { OR: [{ userId: auth.user.id }, { userId: null }] },
    orderBy: { date: "desc" },
    take: 50,
  });

  return apiOk({ notifications });
}
