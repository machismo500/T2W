import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// POST /api/riders/sync-roles - sync user roles based on ride participation
// Users with at least 1 ride participation get "t2w_rider" role
// Users with no participation stay as "rider"
export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 1. Clear ALL droppedOut flags (no dropouts in past rides)
    const clearedDropouts = await prisma.rideParticipation.updateMany({
      where: { droppedOut: true },
      data: { droppedOut: false },
    });

    // 2. Get all users with "rider" role who have linked rider profiles with participations
    const ridersToUpgrade = await prisma.user.findMany({
      where: {
        role: "rider",
        linkedRiderId: { not: null },
      },
      select: { id: true, linkedRiderId: true },
    });

    let upgradedCount = 0;
    const upgradeIds: string[] = [];

    for (const u of ridersToUpgrade) {
      if (!u.linkedRiderId) continue;
      const participationCount = await prisma.rideParticipation.count({
        where: { riderProfileId: u.linkedRiderId },
      });
      if (participationCount > 0) {
        upgradeIds.push(u.id);
      }
    }

    if (upgradeIds.length > 0) {
      const result = await prisma.user.updateMany({
        where: { id: { in: upgradeIds } },
        data: { role: "t2w_rider" },
      });
      upgradedCount = result.count;
    }

    // 3. Downgrade users with "t2w_rider" who have NO participations back to "rider"
    const t2wRiders = await prisma.user.findMany({
      where: { role: "t2w_rider" },
      select: { id: true, linkedRiderId: true },
    });

    const downgradeIds: string[] = [];
    for (const u of t2wRiders) {
      if (!u.linkedRiderId) {
        downgradeIds.push(u.id);
        continue;
      }
      const participationCount = await prisma.rideParticipation.count({
        where: { riderProfileId: u.linkedRiderId },
      });
      if (participationCount === 0) {
        downgradeIds.push(u.id);
      }
    }

    let downgradedCount = 0;
    if (downgradeIds.length > 0) {
      const result = await prisma.user.updateMany({
        where: { id: { in: downgradeIds } },
        data: { role: "rider" },
      });
      downgradedCount = result.count;
    }

    // 4. Recalculate stats for all users with linked profiles
    const allLinkedUsers = await prisma.user.findMany({
      where: { linkedRiderId: { not: null } },
      select: { id: true, linkedRiderId: true },
    });

    for (const u of allLinkedUsers) {
      if (!u.linkedRiderId) continue;
      const participations = await prisma.rideParticipation.findMany({
        where: { riderProfileId: u.linkedRiderId },
        include: { ride: { select: { distanceKm: true } } },
      });
      const totalKm = participations.reduce((sum, p) => sum + p.ride.distanceKm, 0);
      await prisma.user.update({
        where: { id: u.id },
        data: { totalKm, ridesCompleted: participations.length },
      });
    }

    return NextResponse.json({
      success: true,
      clearedDropouts: clearedDropouts.count,
      upgradedToT2WRider: upgradedCount,
      downgradedToRider: downgradedCount,
    });
  } catch (error) {
    console.error("[T2W] Sync roles error:", error);
    return NextResponse.json({ error: "Failed to sync roles" }, { status: 500 });
  }
}
