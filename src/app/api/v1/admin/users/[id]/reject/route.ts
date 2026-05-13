import { NextRequest, after } from "next/server";
import { prisma } from "@/lib/db";
import { apiError, apiOk } from "@/lib/api/v1/errors";
import { requireBearer, isAdminRole } from "@/lib/api/v1/auth-guard";
import { recordActivity } from "@/lib/api/v1/audit";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireBearer(req);
  if (!auth.ok) return apiError("UNAUTHORIZED", "Authentication required");
  if (!isAdminRole(auth.user.role)) return apiError("FORBIDDEN", "Admin only");

  const { id } = await params;
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return apiError("NOT_FOUND", "User not found");

  // Snapshot the rollback payload before the delete cascades.
  const rollbackData = {
    name: existing.name,
    email: existing.email,
    role: existing.role,
    isApproved: existing.isApproved,
    phone: existing.phone,
  };

  await prisma.user.delete({ where: { id } });

  after(() =>
    recordActivity({
      action: "user_deleted",
      performedBy: { id: auth.user.id, name: auth.user.name },
      target: { id, name: existing.name },
      details: `Deleted ${existing.name} (${existing.email})`,
      rollbackData,
    }).catch(() => {}),
  );

  return apiOk({ success: true, id });
}
