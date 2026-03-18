import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

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

    // Also include rider profiles that don't have a User account
    // so admin can see all people in the system
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

    const combined = [
      ...users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        isApproved: u.isApproved,
        joinDate: u.joinDate?.toISOString().split("T")[0] ?? u.createdAt.toISOString().split("T")[0],
        linkedRiderId: u.linkedRiderId,
        phone: u.phone,
        hasAccount: true,
      })),
      ...unlinkedRiders.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        role: r.role || "rider",
        isApproved: true, // rider profiles are inherently approved
        joinDate: r.joinDate?.toISOString().split("T")[0] ?? "2024-03-16",
        linkedRiderId: r.id,
        phone: r.phone,
        hasAccount: false,
      })),
    ];

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
