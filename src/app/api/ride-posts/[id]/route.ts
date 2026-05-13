import { NextRequest, NextResponse, after } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { notifyUser } from "@/lib/push/dispatch";

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

    const before = await prisma.ridePost.findUnique({
      where: { id },
      select: { approvalStatus: true, authorId: true, rideId: true },
    });
    const post = await prisma.ridePost.update({
      where: { id },
      data: updateData,
    });

    if (
      before?.authorId &&
      data.approvalStatus &&
      before.approvalStatus !== data.approvalStatus &&
      (data.approvalStatus === "approved" || data.approvalStatus === "rejected")
    ) {
      const isApproved = data.approvalStatus === "approved";
      const authorId = before.authorId;
      const rideId = before.rideId;
      after(() =>
        notifyUser({
          userId: authorId,
          type: isApproved ? "success" : "warning",
          title: isApproved ? "Ride post approved" : "Ride post needs changes",
          message: isApproved
            ? "Your photo post is live for everyone to see."
            : "Your photo post wasn't approved. Tap for details.",
          data: { kind: "ride", rideId },
        }).catch((err) => console.warn("[T2W] ride-post push failed:", err)),
      );
    }

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
