import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// PUT /api/users/[id]/approve - approve a pending user
export async function PUT(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const currentUser = await getCurrentUser();
    if (!currentUser || !["superadmin", "core_member"].includes(currentUser.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.user.update({
      where: { id },
      data: { isApproved: true },
    });

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error("[T2W] User approve error:", error);
    return NextResponse.json({ error: "Failed to approve user" }, { status: 500 });
  }
}
