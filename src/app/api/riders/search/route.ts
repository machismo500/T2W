import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/riders/search?q=... - lightweight rider search for autocomplete
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "superadmin" && user.role !== "core_member")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const q = req.nextUrl.searchParams.get("q") || "";
    if (q.length < 1) {
      return NextResponse.json({ results: [] });
    }

    const profiles = await prisma.riderProfile.findMany({
      where: {
        mergedIntoId: null,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { phone: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, email: true, phone: true },
      orderBy: { name: "asc" },
      take: 10,
    });

    return NextResponse.json({ results: profiles });
  } catch (error) {
    console.error("[T2W] Rider search error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
