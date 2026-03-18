import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/content - list all content items
export async function GET() {
  try {
    const content = await prisma.content.findMany({
      orderBy: { lastUpdated: "desc" },
    });
    return NextResponse.json({ content });
  } catch (error) {
    console.error("[content] GET error:", error);
    return NextResponse.json({ content: [] });
  }
}

// POST /api/content - create content item (admin only)
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !["superadmin", "core_member"].includes(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { title, type, status } = await req.json();
    if (!title || !type) {
      return NextResponse.json({ error: "Title and type required" }, { status: 400 });
    }

    const content = await prisma.content.create({
      data: { title, type, status: status || "draft" },
    });

    return NextResponse.json({ content }, { status: 201 });
  } catch (error) {
    console.error("[content] POST error:", error);
    return NextResponse.json({ error: "Failed to create content" }, { status: 500 });
  }
}
