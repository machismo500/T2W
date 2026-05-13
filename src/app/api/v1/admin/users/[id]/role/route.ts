import { NextRequest, after } from "next/server";
import { prisma } from "@/lib/db";
import { getRolePermissions } from "@/lib/role-permissions";
import { apiError, apiOk } from "@/lib/api/v1/errors";
import { requireBearer } from "@/lib/api/v1/auth-guard";
import { recordActivity } from "@/lib/api/v1/audit";

const VALID_ROLES = ["superadmin", "core_member", "t2w_rider", "rider", "guest"] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireBearer(req);
  if (!auth.ok) return apiError("UNAUTHORIZED", "Authentication required");

  const isSuper = auth.user.role === "superadmin";
  let coreWithPermission = false;
  if (auth.user.role === "core_member") {
    const perms = await getRolePermissions();
    coreWithPermission = perms.core_member.canManageRoles;
  }
  if (!isSuper && !coreWithPermission) {
    return apiError("FORBIDDEN", "Only super admins or core members with role management permission can change roles");
  }

  const { id } = await params;
  const { newRole } = (await req.json()) as { newRole?: string };
  if (!newRole || !VALID_ROLES.includes(newRole as (typeof VALID_ROLES)[number])) {
    return apiError("BAD_REQUEST", `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}`);
  }

  // Core members can't promote to admin/superadmin
  if (!isSuper && (newRole === "superadmin" || newRole === "core_member")) {
    return apiError(
      "FORBIDDEN",
      "Core members can only assign rider or t2w_rider roles",
    );
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return apiError("NOT_FOUND", "User not found");

  const previousRole = user.role;
  await prisma.user.update({ where: { id }, data: { role: newRole } });
  if (user.linkedRiderId) {
    // Keep RiderProfile in sync the same way the web does.
    await prisma.riderProfile.update({
      where: { id: user.linkedRiderId },
      data: { role: newRole },
    });
  }

  after(() =>
    recordActivity({
      action: "user_role_changed",
      performedBy: { id: auth.user.id, name: auth.user.name },
      target: { id, name: user.name },
      details: `Changed role from ${previousRole} to ${newRole}`,
      rollbackData: { previousRole },
    }).catch(() => {}),
  );

  return apiOk({ success: true, id, newRole });
}
