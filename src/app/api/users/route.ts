import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, hashPassword } from "@/lib/auth";

// GET /api/users - list all users (admin only)
// ?status=pending - filter to unapproved users
// ?status=active  - filter to approved users
export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !["superadmin", "core_member"].includes(currentUser.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const status = req.nextUrl.searchParams.get("status");

    const where: Record<string, unknown> = {};
    if (status === "pending") where.isApproved = false;
    else if (status === "active") where.isApproved = true;

    const users = await prisma.user.findMany({
      where,
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
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Only include unlinked rider profiles when listing ALL users (no status filter)
    // When filtering by pending/active, only return actual User accounts
    let combined = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      isApproved: u.isApproved,
      joinDate: u.joinDate?.toISOString().split("T")[0] ?? u.createdAt.toISOString().split("T")[0],
      linkedRiderId: u.linkedRiderId,
      phone: u.phone,
      hasAccount: true,
    }));

    if (!status) {
      // Include rider profiles that don't have a User account
      const userLinkedIds = new Set(
        users.filter((u) => u.linkedRiderId).map((u) => u.linkedRiderId!)
      );
      const userEmails = new Set(users.map((u) => u.email.toLowerCase()));

      const unlinkedRiders = await prisma.riderProfile.findMany({
        where: {
          mergedIntoId: null,
          id: { notIn: [...userLinkedIds] },
          email: { notIn: [...userEmails] },
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          joinDate: true,
          phone: true,
        },
      });

      combined = [
        ...combined,
        ...unlinkedRiders.map((r) => ({
          id: r.id,
          name: r.name,
          email: r.email,
          role: r.role || "rider",
          isApproved: true,
          joinDate: r.joinDate?.toISOString().split("T")[0] ?? "2024-03-16",
          linkedRiderId: r.id,
          phone: r.phone,
          hasAccount: false,
        })),
      ];
    }

    return NextResponse.json({
      users: combined,
      totalUsers: combined.length,
      pendingUsers: combined.filter((u) => !u.isApproved).length,
    });
  } catch (error) {
    console.error("[T2W] Users list error:", error);
    return NextResponse.json({ error: "Failed to list users" }, { status: 500 });
  }
}

// POST /api/users - create/restore a user (superadmin only, used by rollback)
export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const data = await req.json();
    const email = String(data.email || "").toLowerCase().trim();
    const name = String(data.name || "").trim();
    if (!email || !name) {
      return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
    }

    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "User already exists" }, { status: 409 });
    }

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: await hashPassword("t2w-restored-" + Date.now()),
        role: String(data.role || "rider"),
        isApproved: data.isApproved !== false,
        phone: data.phone || null,
      },
    });

    return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email } });
  } catch (error) {
    console.error("[T2W] User create error:", error);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}
