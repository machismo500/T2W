import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// POST /api/riders/clear-dropouts - clear all droppedOut flags (superadmin only)
export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Count before
    const droppedCount = await prisma.rideParticipation.count({
      where: { droppedOut: true },
    });

    // Clear all droppedOut flags
    const result = await prisma.rideParticipation.updateMany({
      where: { droppedOut: true },
      data: { droppedOut: false },
    });

    // Recalculate stats for all affected riders
    const affectedParticipations = await prisma.rideParticipation.findMany({
      select: { riderProfileId: true },
      distinct: ["riderProfileId"],
    });

    for (const p of affectedParticipations) {
      const linkedUsers = await prisma.user.findMany({
        where: { linkedRiderId: p.riderProfileId },
        select: { id: true, role: true },
      });
      if (linkedUsers.length === 0) continue;

      const participations = await prisma.rideParticipation.findMany({
        where: { riderProfileId: p.riderProfileId },
        include: { ride: { select: { distanceKm: true } } },
      });
      const totalKm = participations.reduce((sum, pp) => sum + pp.ride.distanceKm, 0);
      const ridesCompleted = participations.length;

      for (const u of linkedUsers) {
        const updateData: Record<string, unknown> = { totalKm, ridesCompleted };
        if (u.role === "rider" && ridesCompleted > 0) {
          updateData.role = "t2w_rider";
        }
        await prisma.user.update({ where: { id: u.id }, data: updateData });
      }
    }

    return NextResponse.json({
      success: true,
      clearedCount: result.count,
      previousDroppedCount: droppedCount,
    });
  } catch (error) {
    console.error("[T2W] Clear dropouts error:", error);
    return NextResponse.json({ error: "Failed to clear dropouts" }, { status: 500 });
  }
}

// GET /api/riders/clear-dropouts - check dropout stats (superadmin only)
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const total = await prisma.rideParticipation.count();
    const dropped = await prisma.rideParticipation.count({ where: { droppedOut: true } });

    // Get breakdown by ride
    const byRide = await prisma.rideParticipation.groupBy({
      by: ["rideId"],
      where: { droppedOut: true },
      _count: true,
    });

    const rideDetails = await prisma.ride.findMany({
      where: { id: { in: byRide.map((r) => r.rideId) } },
      select: { id: true, title: true, rideNumber: true },
    });

    const rideMap = Object.fromEntries(rideDetails.map((r) => [r.id, r]));

    return NextResponse.json({
      total,
      droppedOut: dropped,
      byRide: byRide.map((r) => ({
        rideId: r.rideId,
        rideNumber: rideMap[r.rideId]?.rideNumber,
        rideTitle: rideMap[r.rideId]?.title,
        droppedCount: r._count,
      })),
    });
  } catch (error) {
    console.error("[T2W] Dropout stats error:", error);
    return NextResponse.json({ error: "Failed to get stats" }, { status: 500 });
  }
}
