import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/guidelines - Return all guidelines
export async function GET() {
  try {
    const guidelines = await prisma.guideline.findMany({
      orderBy: { id: "asc" },
    });

    return NextResponse.json({ guidelines });
  } catch (error) {
    console.error("[T2W] List guidelines error:", error);
    return NextResponse.json(
      { error: "Failed to load guidelines" },
      { status: 500 }
    );
  }
}

// POST /api/guidelines - Create a new guideline
export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { title, content, category, icon } = data;

    const guideline = await prisma.guideline.create({
      data: {
        title,
        content,
        category,
        icon,
      },
    });

    return NextResponse.json({ guideline });
  } catch (error) {
    console.error("[T2W] Create guideline error:", error);
    return NextResponse.json(
      { error: "Failed to create guideline" },
      { status: 500 }
    );
  }
}
