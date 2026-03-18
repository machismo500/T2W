import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// PUT /api/ride-posts/[id] - update approval status or content
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (
      !user ||
      (user.role !== "superadmin" && user.role !== "core_member")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const data = await req.json();

    const updateData: Record<string, unknown> = {};
    if (data.approvalStatus) {
      updateData.approvalStatus = data.approvalStatus;
      updateData.approvedBy = user.name;
    }
    if (data.content !== undefined) updateData.content = data.content;

    const post = await prisma.ridePost.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      post: {
        id: post.id,
        approvalStatus: post.approvalStatus,
        approvedBy: post.approvedBy,
      },
    });
  } catch (error) {
    console.error("[T2W] Update ride post error:", error);
    return NextResponse.json(
      { error: "Failed to update ride post" },
      { status: 500 }
    );
  }
}

// DELETE /api/ride-posts/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (
      !user ||
      (user.role !== "superadmin" && user.role !== "core_member")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    await prisma.ridePost.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[T2W] Delete ride post error:", error);
    return NextResponse.json(
      { error: "Failed to delete ride post" },
      { status: 500 }
    );
  }
}
