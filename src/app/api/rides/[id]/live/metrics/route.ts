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

    // Break time — only count closed breaks. Open breaks are still running;
    // the ride-end flow auto-closes them, so anything left open mid-ride is
    // "in progress" and excluded from the completed-break total.
    let breakMs = 0;
    let closedBreakCount = 0;
    for (const b of session.breaks) {
      if (!b.endedAt) continue;
      breakMs += b.endedAt.getTime() - b.startedAt.getTime();
      closedBreakCount += 1;
    }
    const breakMinutes = Math.round(breakMs / 60000);

    // Run all location queries in parallel.
    // For distance, prefer the smoothed/gap-filled series for the lead rider
    // when one exists — raw recorded points have straight-line shortcuts
    // across no-signal stretches and under-count switchback distance.
    const [leadPoints, smoothedLeadPoints, speedStats, riderCountRows] = await Promise.all([
      // For distance we aggregate every point (decimation distorts totals),
      // but the projection is trivially indexed and only 2 floats each —
      // 100k points is ~1.5 MB. No pagination here; see /live for the UI cap.
      session.leadRiderId
        ? prisma.liveRideLocation.findMany({
            where: { sessionId: session.id, userId: session.leadRiderId },
            orderBy: { recordedAt: "asc" },
            select: { lat: true, lng: true },
          })
        : Promise.resolve([]),
      session.leadRiderId
        ? prisma.liveRideLocationSmoothed.findMany({
            where: { sessionId: session.id, userId: session.leadRiderId },
            orderBy: { sourceOrder: "asc" },
            select: { lat: true, lng: true },
          })
        : Promise.resolve([]),
      prisma.liveRideLocation.aggregate({
        where: {
          sessionId: session.id,
          speed: { not: null, gt: 0 },
        },
        _avg: { speed: true },
        _max: { speed: true },
      }),
      prisma.liveRideLocation.findMany({
        where: { sessionId: session.id },
        distinct: ["userId"],
        select: { userId: true },
      }),
    ]);

    // Distance: prefer manual override > smoothed series > raw points.
    const usedSmoothedDistance =
      session.distanceKmOverride == null && smoothedLeadPoints.length > 1;
    const distancePoints = usedSmoothedDistance ? smoothedLeadPoints : leadPoints;
    const computedDistanceKm = session.leadRiderId
      ? Math.round(pathDistanceKm(distancePoints) * 10) / 10
      : 0;
    const distanceKm =
      session.distanceKmOverride != null
        ? Math.round(session.distanceKmOverride * 10) / 10
        : computedDistanceKm;
    const distanceSource: "override" | "smoothed" | "raw" =
      session.distanceKmOverride != null
        ? "override"
        : usedSmoothedDistance
          ? "smoothed"
          : "raw";

    // Moving Time excludes break time. Clamped at 0 in case of clock skew or
    // a paused-then-ended session where break minutes briefly exceed elapsed.
    const computedMovingMinutes = Math.max(0, elapsedMinutes - breakMinutes);
    const movingMinutes =
      session.movingMinutesOverride != null
        ? session.movingMinutesOverride
        : computedMovingMinutes;

    const computedAvgSpeedKmh = Math.round((speedStats._avg.speed || 0) * 10) / 10;
    const computedMaxSpeedKmh = Math.round((speedStats._max.speed || 0) * 10) / 10;
    const avgSpeedKmh =
      session.avgSpeedKmhOverride != null
        ? Math.round(session.avgSpeedKmhOverride * 10) / 10
        : computedAvgSpeedKmh;
    const maxSpeedKmh =
      session.maxSpeedKmhOverride != null
        ? Math.round(session.maxSpeedKmhOverride * 10) / 10
        : computedMaxSpeedKmh;

    return NextResponse.json({
      elapsedMinutes,
      movingMinutes,
      distanceKm,
      distanceSource,
      avgSpeedKmh,
      maxSpeedKmh,
      breakCount: closedBreakCount,
      breakMinutes,
      riderCount: riderCountRows.length,
      startedAt: session.startedAt?.toISOString() ?? null,
      endedAt: session.endedAt?.toISOString() ?? null,
      elevationGainM: session.elevationGainM,
      elevationLossM: session.elevationLossM,
      // Diagnostics — let the UI badge an override or fall back to computed.
      // `computed*` are the underlying values so admins can sanity-check
      // their overrides without leaving the page.
      overrides: {
        distanceKm: session.distanceKmOverride,
        avgSpeedKmh: session.avgSpeedKmhOverride,
        maxSpeedKmh: session.maxSpeedKmhOverride,
        movingMinutes: session.movingMinutesOverride,
      },
      computed: {
        distanceKm: computedDistanceKm,
        avgSpeedKmh: computedAvgSpeedKmh,
        maxSpeedKmh: computedMaxSpeedKmh,
        movingMinutes: computedMovingMinutes,
      },
    });
  } catch (error) {
    console.error("[T2W] Metrics error:", error);
    return NextResponse.json(
      { error: "Failed to calculate metrics" },
      { status: 500 }
    );
  }
}
