import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// POST /api/users/bulk-approve - approve multiple pending users at once
export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !["superadmin", "core_member"].includes(currentUser.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { ids } = await req.json();

    if (Array.isArray(ids) && ids.length > 0) {
      // Approve specific users by ID
      const result = await prisma.user.updateMany({
        where: { id: { in: ids }, isApproved: false },
        data: { isApproved: true },
      });
      return NextResponse.json({ success: true, approvedCount: result.count });
    }

    // No ids = approve ALL pending users
    const result = await prisma.user.updateMany({
      where: { isApproved: false },
      data: { isApproved: true },
    });

    return NextResponse.json({ success: true, approvedCount: result.count });
  } catch (error) {
    console.error("[T2W] Bulk approve error:", error);
    return NextResponse.json({ error: "Failed to approve users" }, { status: 500 });
  }
}
