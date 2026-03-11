import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// PUT /api/users/role - change a user's role (superadmin only)
// Searches by userId, linkedRiderId, riderProfile ID, or email
export async function PUT(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "superadmin") {
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

    // Try to find the user by multiple strategies
    let user = userId ? await prisma.user.findUnique({ where: { id: userId } }) : null;

    if (!user && userId) {
      // The ID might be a RiderProfile ID - check if a User is linked to it
      user = await prisma.user.findFirst({ where: { linkedRiderId: userId } });
    }

    if (!user && email) {
      // Try by email directly
      user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    }

    if (!user && userId) {
      // Check if there's a RiderProfile with this ID and a User with the same email
      const riderProfile = await prisma.riderProfile.findUnique({
        where: { id: userId },
      });
      if (riderProfile && riderProfile.email) {
        user = await prisma.user.findUnique({ where: { email: riderProfile.email } });
        if (user) {
          // Also link the user to the rider profile
          await prisma.user.update({
            where: { id: user.id },
            data: { role: newRole, linkedRiderId: riderProfile.id },
          });
          return NextResponse.json({
            success: true,
            userId: user.id,
            role: newRole,
          });
        }
      }
    }

    if (!user) {
      return NextResponse.json({
        error: "No user account found. The rider needs to register first.",
      }, { status: 404 });
    }

    const previousRole = user.role;
    await prisma.user.update({
      where: { id: user.id },
      data: { role: newRole },
    });

    return NextResponse.json({
      success: true,
      userId: user.id,
      previousRole,
      role: newRole,
    });
  } catch (error) {
    console.error("[T2W] Role change error:", error);
    return NextResponse.json({ error: "Failed to change role" }, { status: 500 });
  }
}
