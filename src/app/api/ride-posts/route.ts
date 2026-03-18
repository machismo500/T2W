import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/ride-posts?rideId=xxx&status=approved|pending
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rideId = searchParams.get("rideId");
    const status = searchParams.get("status"); // "approved", "pending", or null for all

    const where: Record<string, unknown> = {};
    if (rideId) where.rideId = rideId;
    if (status) where.approvalStatus = status;

    // Non-admins can only see approved posts
    if (!status) {
      const user = await getCurrentUser();
      const isAdmin =
        user?.role === "superadmin" || user?.role === "core_member";
      if (!isAdmin) {
        where.approvalStatus = "approved";
      }
    }

    const posts = await prisma.ridePost.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      posts: posts.map((p) => ({
        id: p.id,
        rideId: p.rideId,
        authorId: p.authorId,
        authorName: p.authorName,
        content: p.content,
        images: p.images ? JSON.parse(p.images) : [],
        approvalStatus: p.approvalStatus,
        approvedBy: p.approvedBy,
        createdAt: p.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("[T2W] List ride posts error:", error);
    return NextResponse.json(
      { error: "Failed to list ride posts" },
      { status: 500 }
    );
  }
}

// POST /api/ride-posts - create a new ride post
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await req.json();
    const isAdmin =
      user.role === "superadmin" || user.role === "core_member";

    const post = await prisma.ridePost.create({
      data: {
        rideId: String(data.rideId),
        authorId: data.authorId || user.id,
        authorName: data.authorName || user.name,
        content: String(data.content || ""),
        images: data.images ? JSON.stringify(data.images) : null,
        approvalStatus: isAdmin
          ? "approved"
          : (data.approvalStatus as string) || "pending",
        approvedBy: isAdmin ? user.name : (data.approvedBy as string) || undefined,
      },
    });

    return NextResponse.json({
      post: {
        id: post.id,
        rideId: post.rideId,
        authorId: post.authorId,
        authorName: post.authorName,
        content: post.content,
        images: post.images ? JSON.parse(post.images) : [],
        approvalStatus: post.approvalStatus,
        approvedBy: post.approvedBy,
        createdAt: post.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("[T2W] Create ride post error:", error);
    return NextResponse.json(
      { error: "Failed to create ride post" },
      { status: 500 }
    );
  }
}
