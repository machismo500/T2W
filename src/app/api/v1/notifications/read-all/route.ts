import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { apiError, apiOk } from "@/lib/api/v1/errors";
import { requireBearer } from "@/lib/api/v1/auth-guard";

/**
 * POST /api/v1/notifications/read-all — clears the unread badge for the
 * current user. Only marks *their* notifications; global notifications stay
 * untouched.
 */
export async function POST(req: NextRequest) {
  const auth = await requireBearer(req);
  if (!auth.ok) return apiError("UNAUTHORIZED", "Authentication required");

  const result = await prisma.notification.updateMany({
    where: { userId: auth.user.id, isRead: false },
    data: { isRead: true },
  });

  return apiOk({ updated: result.count });
}
