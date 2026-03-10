import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/badges - list all badge tiers
export async function GET() {
  try {
    const badges = await prisma.badge.findMany({
      orderBy: { minKm: "asc" },
    });
    return NextResponse.json({ badges });
  } catch (error) {
    console.error("[T2W] List badges error:", error);
    return NextResponse.json({ error: "Failed to load badges" }, { status: 500 });
  }
}

// POST /api/badges/check - recalculate and award badges for the current user
export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const awarded = await awardBadgesForUser(user.id, user.totalKm);
    return NextResponse.json({ awarded });
  } catch (error) {
    console.error("[T2W] Check badges error:", error);
    return NextResponse.json({ error: "Failed to check badges" }, { status: 500 });
  }
}

// Award any badges the user has earned based on totalKm
export async function awardBadgesForUser(userId: string, totalKm: number): Promise<string[]> {
  const allBadges = await prisma.badge.findMany({
    orderBy: { minKm: "asc" },
  });

  const existingBadges = await prisma.userBadge.findMany({
    where: { userId },
    select: { badgeId: true },
  });
  const existingBadgeIds = new Set(existingBadges.map((b: { badgeId: string }) => b.badgeId));

  const newlyAwarded: string[] = [];

  for (const badge of allBadges) {
    if (totalKm >= badge.minKm && !existingBadgeIds.has(badge.id)) {
      await prisma.userBadge.create({
        data: { userId, badgeId: badge.id },
      });
      newlyAwarded.push(badge.name);
    }
  }

  return newlyAwarded;
}
