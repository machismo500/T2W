import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getRolePermissions } from "@/lib/role-permissions";

// PUT /api/users/role - change a user/rider's role
// Super admins can set any role. Core members with canManageRoles can promote to rider/t2w_rider only.
export async function PUT(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isSuperAdmin = currentUser.role === "superadmin";
    let isCoreMemberWithPermission = false;
    if (currentUser.role === "core_member") {
      const perms = await getRolePermissions();
      isCoreMemberWithPermission = perms.core_member.canManageRoles;
    }

    if (!isSuperAdmin && !isCoreMemberWithPermission) {
      return NextResponse.json({ error: "Only super admins can change roles" }, { status: 403 });
    }

    const { userId, email, newRole } = await req.json();
    if (!newRole || (!userId && !email)) {
      return NextResponse.json({ error: "newRole and either userId or email are required" }, { status: 400 });
    }

    const validRoles = ["superadmin", "core_member", "t2w_rider", "rider", "guest"];
    if (!validRoles.includes(newRole)) {
      return NextResponse.json({ error: `Invalid role. Must be one of: ${validRoles.join(", ")}` }, { status: 400 });
    }

    // Core members can only assign rider or t2w_rider — not core_member/superadmin
    if (isCoreMemberWithPermission && !isSuperAdmin) {
      const coreMemberAllowed = ["rider", "t2w_rider"];
      if (!coreMemberAllowed.includes(newRole)) {
        return NextResponse.json({ error: "Core members can only assign rider or t2w_rider roles" }, { status: 403 });
      }
    }

    let updatedUser = false;
    let updatedRider = false;
    let resultId = userId;

    // 1. Try to update the User account (if it exists)
    let user = userId ? await prisma.user.findUnique({ where: { id: userId } }) : null;
    if (!user && userId) {
      user = await prisma.user.findFirst({ where: { linkedRiderId: userId } });
    }
    if (!user && email) {
      user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    }
    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: { role: newRole },
      });
      updatedUser = true;
      resultId = user.id;

      // Also update the linked RiderProfile if it exists
      if (user.linkedRiderId) {
        await prisma.riderProfile.update({
          where: { id: user.linkedRiderId },
          data: { role: newRole },
        }).catch(() => { /* rider profile may not exist */ });
        updatedRider = true;
      }
    }

    // 2. Try to update the RiderProfile directly (by ID or email)
    if (!updatedRider && userId) {
      const riderProfile = await prisma.riderProfile.findUnique({ where: { id: userId } });
      if (riderProfile) {
        await prisma.riderProfile.update({
          where: { id: riderProfile.id },
          data: { role: newRole },
        });
        updatedRider = true;
        resultId = riderProfile.id;

        // Also update the linked User if exists
        if (!updatedUser && riderProfile.email) {
          const linkedUser = await prisma.user.findUnique({ where: { email: riderProfile.email } });
          if (linkedUser) {
            await prisma.user.update({
              where: { id: linkedUser.id },
              data: { role: newRole, linkedRiderId: riderProfile.id },
            });
            updatedUser = true;
          }
        }
      }
    }

    // 3. Try by email on RiderProfile
    if (!updatedRider && email) {
      const riderProfiles = await prisma.riderProfile.findMany({
        where: { email: { equals: email.toLowerCase().trim(), mode: "insensitive" } },
        take: 1,
      });
      if (riderProfiles.length > 0) {
        await prisma.riderProfile.update({
          where: { id: riderProfiles[0].id },
          data: { role: newRole },
        });
        updatedRider = true;
        resultId = riderProfiles[0].id;
      }
    }

    if (!updatedUser && !updatedRider) {
      return NextResponse.json({
        error: "No user or rider profile found with the given ID or email.",
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      userId: resultId,
      role: newRole,
      updatedUser,
      updatedRider,
    });
  } catch (error) {
    console.error("[T2W] Role change error:", error);
    return NextResponse.json({ error: "Failed to change role" }, { status: 500 });
  }
}
