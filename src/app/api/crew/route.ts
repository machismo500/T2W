import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/crew - dynamically list crew members based on DB roles
// Queries BOTH User table and RiderProfile table for superadmin/core_member roles
// Excludes T2W Official system account
export async function GET() {
  try {
    const crewRoles = ["superadmin", "core_member"];

    // 1. Get crew from User table (registered users with core roles)
    const crewUsers = await prisma.user.findMany({
      where: {
        role: { in: crewRoles },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        linkedRiderId: true,
        riderProfile: {
          select: {
            id: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // 2. Get crew from RiderProfile table (riders tagged as core_member who may not have User accounts)
    const crewRiders = await prisma.riderProfile.findMany({
      where: {
        role: { in: crewRoles },
        mergedIntoId: null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
      },
      orderBy: { createdAt: "asc" },
    });

    // Merge: use a map keyed by email to deduplicate
    const seen = new Set<string>();
    const crew: Array<{
      id: string;
      name: string;
      role: string;
      linkedRiderId: string | null;
      avatarUrl: string | null;
    }> = [];

    // Add User-based crew first (they have auth accounts)
    for (const u of crewUsers) {
      // Exclude T2W Official system account
      if (u.email.toLowerCase().includes("taleson2wheels.official")) continue;

      const key = u.email.toLowerCase().trim();
      if (seen.has(key)) continue;
      seen.add(key);

      crew.push({
        id: u.id,
        name: u.name,
        role: u.role,
        linkedRiderId: u.linkedRiderId || u.riderProfile?.id || null,
        avatarUrl: u.riderProfile?.avatarUrl || null,
      });
    }

    // Add RiderProfile-based crew (riders without User accounts but tagged as core)
    for (const r of crewRiders) {
      // Exclude T2W Official system account
      if (r.email.toLowerCase().includes("taleson2wheels.official")) continue;

      const key = r.email.toLowerCase().trim();
      if (seen.has(key)) continue;
      seen.add(key);

      crew.push({
        id: r.id,
        name: r.name,
        role: r.role,
        linkedRiderId: r.id,
        avatarUrl: r.avatarUrl || null,
      });
    }

    return NextResponse.json({ crew });
  } catch (error) {
    console.error("[T2W] Crew error:", error);
    return NextResponse.json({ error: "Failed to load crew" }, { status: 500 });
  }
}
