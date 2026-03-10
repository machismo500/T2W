import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/motorcycles - list current user's motorcycles
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const motorcycles = await prisma.motorcycle.findMany({
      where: { userId: user.id },
      orderBy: { id: "asc" },
    });

    return NextResponse.json({ motorcycles });
  } catch (error) {
    console.error("[T2W] List motorcycles error:", error);
    return NextResponse.json({ error: "Failed to load motorcycles" }, { status: 500 });
  }
}

// POST /api/motorcycles - add a new motorcycle
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const data = await req.json();
    const { make, model, year, cc, color, nickname } = data;

    if (!make || !model) {
      return NextResponse.json({ error: "Make and model are required" }, { status: 400 });
    }

    const motorcycle = await prisma.motorcycle.create({
      data: {
        make: String(make).trim(),
        model: String(model).trim(),
        year: Number(year) || new Date().getFullYear(),
        cc: Number(cc) || 0,
        color: String(color || "").trim(),
        nickname: nickname ? String(nickname).trim() : null,
        userId: user.id,
      },
    });

    return NextResponse.json({ motorcycle });
  } catch (error) {
    console.error("[T2W] Create motorcycle error:", error);
    return NextResponse.json({ error: "Failed to create motorcycle" }, { status: 500 });
  }
}
