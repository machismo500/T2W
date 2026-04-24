import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/users/[id] - get a single user
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isApproved: true,
        joinDate: true,
        linkedRiderId: true,
        phone: true,
        city: true,
        ridingExperience: true,
        notifyRides: true,
        adminNotifySelected: true,
      },
    });

    if (!user) {
      // Check if it's a rider profile ID
      const rider = await prisma.riderProfile.findUnique({
        where: { id },
        select: { id: true, name: true, email: true, role: true, phone: true, joinDate: true },
      });
      if (rider) {
        return NextResponse.json({
          user: { ...rider, isApproved: true, linkedRiderId: rider.id, hasAccount: false },
        });
      }
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("[T2W] User get error:", error);
    return NextResponse.json({ error: "Failed to get user" }, { status: 500 });
  }
}

// PUT /api/users/[id] - update user (admin only)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const currentUser = await getCurrentUser();
    if (!currentUser || !["superadmin", "core_member"].includes(currentUser.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const data = await req.json();
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = String(data.name);
    if (data.email !== undefined) updateData.email = String(data.email).toLowerCase().trim();
    if (data.phone !== undefined) updateData.phone = String(data.phone);
    if (data.role !== undefined) {
      const validRoles = ["rider", "t2w_rider", "core_member", "superadmin"];
      if (!validRoles.includes(String(data.role))) {
        return NextResponse.json({ error: "Invalid role" }, { status: 400 });
      }
      // Only superadmins can grant core_member or superadmin roles
      const privilegedRoles = ["core_member", "superadmin"];
      if (privilegedRoles.includes(String(data.role)) && currentUser.role !== "superadmin") {
        return NextResponse.json({ error: "Only superadmins can grant elevated roles" }, { status: 403 });
      }
      updateData.role = String(data.role);
    }
    if (data.isApproved !== undefined) updateData.isApproved = Boolean(data.isApproved);
    if (data.notifyRides !== undefined) updateData.notifyRides = Boolean(data.notifyRides);
    if (data.adminNotifySelected !== undefined) updateData.adminNotifySelected = Boolean(data.adminNotifySelected);

    // Try updating User record first
    let user = await prisma.user.findUnique({ where: { id } });
    if (user) {
      const updated = await prisma.user.update({ where: { id }, data: updateData });
      // Sync role to linked RiderProfile
      if (data.role && updated.linkedRiderId) {
        await prisma.riderProfile.update({
          where: { id: updated.linkedRiderId },
          data: { role: data.role },
        }).catch(() => {});
      }
      return NextResponse.json({ user: { id, ...data } });
    }

    // Maybe it's a rider profile ID
    const rider = await prisma.riderProfile.findUnique({ where: { id } });
    if (rider) {
      const riderUpdate: Record<string, unknown> = {};
      if (data.name !== undefined) riderUpdate.name = data.name;
      if (data.email !== undefined) riderUpdate.email = data.email;
      if (data.phone !== undefined) riderUpdate.phone = data.phone;
      if (data.role !== undefined) riderUpdate.role = data.role;
      if (data.notifyRides !== undefined) riderUpdate.notifyRides = Boolean(data.notifyRides);
      await prisma.riderProfile.update({ where: { id }, data: riderUpdate });
      // Also update linked User if exists
      const linkedUser = await prisma.user.findFirst({ where: { linkedRiderId: id } });
      if (linkedUser) {
        await prisma.user.update({ where: { id: linkedUser.id }, data: updateData }).catch(() => {});
      }
      return NextResponse.json({ user: { id, ...data } });
    }

    return NextResponse.json({ error: "User not found" }, { status: 404 });
  } catch (error) {
    console.error("[T2W] User update error:", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

// DELETE /api/users/[id] - delete user (superadmin only)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "superadmin") {
      return NextResponse.json({ error: "Only super admins can delete users" }, { status: 403 });
    }

    // Protect built-in superadmin accounts. The list is env-driven so rotating
    // the protected set doesn't require a code change. Falls back to the
    // historical built-ins so existing deployments keep working without an
    // env var set.
    const envList = (process.env.PROTECTED_ADMIN_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const protectedEmails = envList.length
      ? envList
      : ["roshan.manuel@gmail.com", "taleson2wheels.official@gmail.com"];
    const user = await prisma.user.findUnique({ where: { id } });
    if (user && protectedEmails.includes(user.email.toLowerCase())) {
      return NextResponse.json({ error: "Cannot delete protected admin account" }, { status: 403 });
    }

    if (user) {
      await prisma.user.delete({ where: { id } });
      return NextResponse.json({ success: true, id });
    }

    // Try rider profile
    const rider = await prisma.riderProfile.findUnique({ where: { id } });
    if (rider) {
      // Don't delete rider profile, just unlink any User
      const linkedUser = await prisma.user.findFirst({ where: { linkedRiderId: id } });
      if (linkedUser) {
        await prisma.user.delete({ where: { id: linkedUser.id } });
      }
      return NextResponse.json({ success: true, id });
    }

    return NextResponse.json({ error: "User not found" }, { status: 404 });
  } catch (error) {
    console.error("[T2W] User delete error:", error);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
