import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// PUT /api/users/role - change a user's role (superadmin only)
// Also handles riders who only have a RiderProfile (no User account yet)
export async function PUT(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "superadmin") {
      return NextResponse.json({ error: "Only super admins can change roles" }, { status: 403 });
    }

    const { userId, newRole } = await req.json();
    if (!userId || !newRole) {
      return NextResponse.json({ error: "userId and newRole are required" }, { status: 400 });
    }

    const validRoles = ["superadmin", "core_member", "t2w_rider", "rider", "guest"];
    if (!validRoles.includes(newRole)) {
      return NextResponse.json({ error: `Invalid role. Must be one of: ${validRoles.join(", ")}` }, { status: 400 });
    }

    // Try to find the user by ID in the User table
    let user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      // The ID might be a RiderProfile ID - check if a User is linked to it
      user = await prisma.user.findFirst({ where: { linkedRiderId: userId } });
    }

    if (!user) {
      // No User account exists. Check if there's a RiderProfile with this ID
      // and create a minimal User account linked to it.
      const riderProfile = await prisma.riderProfile.findUnique({
        where: { id: userId },
      });
      if (riderProfile) {
        // Check if a user already exists with this email
        user = await prisma.user.findUnique({ where: { email: riderProfile.email } });
        if (user) {
          // Link and update role
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
        // No user at all - can't create without password, just return info
        return NextResponse.json({
          error: "This rider has no user account. They need to register first before their role can be changed.",
        }, { status: 404 });
      }
      return NextResponse.json({ error: "User not found" }, { status: 404 });
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
