import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/riders/search?q=... - unified rider search across RiderProfile AND User tables.
 * Returns deduplicated results so admin can find ANY rider regardless of which table they're in.
 */
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

    // Search both RiderProfile and User tables in parallel
    const [profiles, users] = await Promise.all([
      prisma.riderProfile.findMany({
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
      }),
      prisma.user.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
          ],
        },
        select: { id: true, name: true, email: true, phone: true, linkedRiderId: true },
        orderBy: { name: "asc" },
        take: 10,
      }),
    ]);

    // Build unified results, deduplicating by email
    const seenEmails = new Set<string>();
    const results: Array<{
      id: string;
      name: string;
      email: string | null;
      phone: string | null;
      riderProfileId: string | null;
      userId: string | null;
    }> = [];

    // Add RiderProfile results first (they are the master records)
    for (const p of profiles) {
      const emailKey = p.email?.toLowerCase() || "";
      if (emailKey) seenEmails.add(emailKey);
      // Find if there's a matching user
      const matchedUser = users.find(
        (u) => u.linkedRiderId === p.id || (u.email && p.email && u.email.toLowerCase() === p.email.toLowerCase())
      );
      results.push({
        id: p.id,
        name: p.name,
        email: p.email,
        phone: p.phone,
        riderProfileId: p.id,
        userId: matchedUser?.id || null,
      });
    }

    // Add User-only results (those not already covered by a RiderProfile match)
    for (const u of users) {
      const emailKey = u.email?.toLowerCase() || "";
      if (emailKey && seenEmails.has(emailKey)) continue;
      if (u.linkedRiderId && results.some((r) => r.riderProfileId === u.linkedRiderId)) continue;
      results.push({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        riderProfileId: u.linkedRiderId || null,
        userId: u.id,
      });
    }

    return NextResponse.json({ results: results.slice(0, 15) });
  } catch (error) {
    console.error("[T2W] Rider search error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
