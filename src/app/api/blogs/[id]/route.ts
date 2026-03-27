import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/blogs/[id] - Return a single blog post by ID
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const post = await prisma.blogPost.findUnique({
      where: { id },
    });

    if (!post) {
      return NextResponse.json({ error: "Blog not found" }, { status: 404 });
    }

    const blog = {
      ...post,
      tags: post.tags ? JSON.parse(post.tags) : [],
    };

    return NextResponse.json({ blog });
  } catch (error) {
    console.error("[T2W] Get blog error:", error);
    return NextResponse.json(
      { error: "Failed to load blog" },
      { status: 500 }
    );
  }
}

// PUT /api/blogs/[id] - Update a blog post
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || (currentUser.role !== "superadmin" && currentUser.role !== "core_member")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const data = await req.json();

    // Build update from allowlist to prevent mass-assignment
    const ALLOWED = ["title", "excerpt", "content", "authorName", "authorAvatar",
      "publishDate", "coverImage", "tags", "type", "isVlog", "videoUrl",
      "readTime", "approvalStatus"] as const;
    const updateData: Record<string, unknown> = {};
    for (const key of ALLOWED) {
      if (data[key] !== undefined) updateData[key] = data[key];
    }

    // If tags is provided as an array, stringify it for storage
    if (updateData.tags && Array.isArray(updateData.tags)) {
      updateData.tags = JSON.stringify(updateData.tags);
    }

    // If publishDate is provided as a string, convert to Date
    if (updateData.publishDate) {
      updateData.publishDate = new Date(updateData.publishDate as string);
    }

    const blog = await prisma.blogPost.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ blog });
  } catch (error) {
    console.error("[T2W] Update blog error:", error);
    return NextResponse.json(
      { error: "Failed to update blog" },
      { status: 500 }
    );
  }
}

// DELETE /api/blogs/[id] - Delete a blog post
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || (currentUser.role !== "superadmin" && currentUser.role !== "core_member")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    await prisma.blogPost.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[T2W] Delete blog error:", error);
    return NextResponse.json(
      { error: "Failed to delete blog" },
      { status: 500 }
    );
  }
}
