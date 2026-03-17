import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { pathDistanceKm } from "@/lib/geo-utils";

// GET /api/rides/[id]/live/metrics - calculate ride metrics
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: rideId } = await params;

    const session = await prisma.liveRideSession.findUnique({
      where: { rideId },
      include: { breaks: true },
    });

    if (!session) {
      return NextResponse.json({ error: "No session" }, { status: 404 });
    }

    const startTime = session.startedAt || session.createdAt;
    const endTime = session.endedAt || new Date();
    const elapsedMs = endTime.getTime() - startTime.getTime();
    const elapsedMinutes = Math.round(elapsedMs / 60000);

    // Break time
    let breakMs = 0;
    for (const b of session.breaks) {
      const bEnd = b.endedAt || (session.status === "ended" ? endTime : new Date());
      breakMs += bEnd.getTime() - b.startedAt.getTime();
    }
    const breakMinutes = Math.round(breakMs / 60000);

    // Distance from lead rider's path
    let distanceKm = 0;
    if (session.leadRiderId) {
      const leadPoints = await prisma.liveRideLocation.findMany({
        where: { sessionId: session.id, userId: session.leadRiderId },
        orderBy: { recordedAt: "asc" },
        select: { lat: true, lng: true },
      });
      distanceKm = Math.round(pathDistanceKm(leadPoints) * 10) / 10;
    }

    // Speed stats from all locations
    const speedStats = await prisma.liveRideLocation.aggregate({
      where: {
        sessionId: session.id,
        speed: { not: null, gt: 0 },
      },
      _avg: { speed: true },
      _max: { speed: true },
    });

    // Unique rider count
    const riderCount = await prisma.liveRideLocation.findMany({
      where: { sessionId: session.id },
      distinct: ["userId"],
      select: { userId: true },
    });

    return NextResponse.json({
      elapsedMinutes,
      distanceKm,
      avgSpeedKmh: Math.round((speedStats._avg.speed || 0) * 10) / 10,
      maxSpeedKmh: Math.round((speedStats._max.speed || 0) * 10) / 10,
      breakCount: session.breaks.length,
      breakMinutes,
      riderCount: riderCount.length,
    });
  } catch (error) {
    console.error("[T2W] Metrics error:", error);
    return NextResponse.json(
      { error: "Failed to calculate metrics" },
      { status: 500 }
    );
  }
}
