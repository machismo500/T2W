import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/blogs - Return all blog posts
export async function GET() {
  try {
    const posts = await prisma.blogPost.findMany({
      orderBy: { publishDate: "desc" },
    });

    const blogs = posts.map((post) => ({
      ...post,
      tags: post.tags ? JSON.parse(post.tags) : [],
    }));

    return NextResponse.json({ blogs });
  } catch (error) {
    console.error("[T2W] List blogs error:", error);
    return NextResponse.json(
      { error: "Failed to load blogs" },
      { status: 500 }
    );
  }
}

// POST /api/blogs - Create a new blog post
export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const {
      title,
      excerpt,
      content,
      authorName,
      publishDate,
      tags,
      type,
      isVlog,
      videoUrl,
      readTime,
      likes,
    } = data;

    const blog = await prisma.blogPost.create({
      data: {
        title,
        excerpt,
        content,
        authorName,
        publishDate: publishDate ? new Date(publishDate) : new Date(),
        tags: tags ? JSON.stringify(tags) : "[]",
        type: type || "blog",
        isVlog: isVlog || false,
        videoUrl: videoUrl || null,
        readTime: readTime || 0,
        likes: likes || 0,
      },
    });

    return NextResponse.json({ blog });
  } catch (error) {
    console.error("[T2W] Create blog error:", error);
    return NextResponse.json(
      { error: "Failed to create blog" },
      { status: 500 }
    );
  }
}
