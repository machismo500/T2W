import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { apiError, apiOk } from "@/lib/api/v1/errors";
import { requireBearer } from "@/lib/api/v1/auth-guard";

/**
 * POST /api/v1/notifications/:id/read — mark a single notification as read.
 * Only the owner (per-user notification) can mark theirs read; global
 * notifications (userId=null) can be marked by anyone authed (the read flag
 * isn't per-user-stored on globals, so this acts as a server-wide mark and
 * is rarely useful — but we keep it idempotent for the client).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireBearer(req);
  if (!auth.ok) return apiError("UNAUTHORIZED", "Authentication required");

  const { id } = await params;
  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification) return apiError("NOT_FOUND", "Notification not found");

  if (notification.userId && notification.userId !== auth.user.id) {
    return apiError("FORBIDDEN", "Not yours to read");
  }

  await prisma.notification.update({
    where: { id },
    data: { isRead: true },
  });

  return apiOk({ success: true });
}
