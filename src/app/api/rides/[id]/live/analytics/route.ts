import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { safeJsonParse } from "@/lib/json-utils";
import { pathDistanceKm } from "@/lib/geo-utils";
import {
  computeClimbStats,
  computeCohesion,
  computeSplits,
  summarizeElevation,
  type CohesionInputRider,
  type ElevationProfileSample,
  type LeaderboardEntry,
  type TimedPoint,
} from "@/lib/ride-analytics";

// GET /api/rides/[id]/live/analytics
//
// Returns derived post-ride analytics: pace splits, climb summary, group
// cohesion, leaderboard, and an extended elevation summary (min/max/net).
//
// This endpoint is intentionally separate from /live/metrics — that route is
// called from the live page on a short interval, and shouldn't be paying the
// extra fan-out queries needed here. This one is fetched once on the
// post-ride view.
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
      select: {
        id: true,
        leadRiderId: true,
        sweepRiderId: true,
        startedAt: true,
        endedAt: true,
        createdAt: true,
        elevationProfile: true,
      },
    });
    if (!session) {
      return NextResponse.json({ error: "No session" }, { status: 404 });
    }

    // Cached lead-rider elevation profile — feeds splits/climb/min-max.
    const profile = session.elevationProfile
      ? safeJsonParse<ElevationProfileSample[]>(session.elevationProfile, [])
      : [];

    // Pull lead-rider track for splits — prefer smoothed when present so the
    // per-km buckets don't get distorted by GPS-gap shortcuts.
    type RawTrackRow = {
      lat: number;
      lng: number;
      recordedAt: Date;
      speed: number | null;
    };
    const [smoothedLead, rawLead]: [RawTrackRow[], RawTrackRow[]] = await Promise.all([
      session.leadRiderId
        ? prisma.liveRideLocationSmoothed.findMany({
            where: { sessionId: session.id, userId: session.leadRiderId },
            orderBy: { sourceOrder: "asc" },
            select: { lat: true, lng: true, recordedAt: true, speed: true },
          })
        : Promise.resolve([] as RawTrackRow[]),
      session.leadRiderId
        ? prisma.liveRideLocation.findMany({
            where: { sessionId: session.id, userId: session.leadRiderId },
            orderBy: { recordedAt: "asc" },
            select: { lat: true, lng: true, recordedAt: true, speed: true },
          })
        : Promise.resolve([] as RawTrackRow[]),
    ]);
    const leadTrack: TimedPoint[] =
      smoothedLead.length > 1
        ? smoothedLead.map((p: RawTrackRow) => ({
            lat: p.lat,
            lng: p.lng,
            recordedAt: p.recordedAt,
            speed: p.speed,
          }))
        : rawLead.map((p: RawTrackRow) => ({
            lat: p.lat,
            lng: p.lng,
            recordedAt: p.recordedAt,
            speed: p.speed,
          }));

    // Per-rider data for cohesion + leaderboard. Project lat/lng/timestamp
    // only — heading/accuracy aren't needed and the rows are wide.
    type RiderLocRow = {
      userId: string;
      lat: number;
      lng: number;
      recordedAt: Date;
      speed: number | null;
      isDeviated: boolean;
    };
    const allLocations: RiderLocRow[] = session.leadRiderId
      ? await prisma.liveRideLocation.findMany({
          where: { sessionId: session.id },
          orderBy: { recordedAt: "asc" },
          select: {
            userId: true,
            lat: true,
            lng: true,
            recordedAt: true,
            speed: true,
            isDeviated: true,
          },
        })
      : [];

    // Group points by rider
    const byRider = new Map<string, RiderLocRow[]>();
    const deviationCounts = new Map<string, number>();
    for (const loc of allLocations) {
      let arr = byRider.get(loc.userId);
      if (!arr) {
        arr = [];
        byRider.set(loc.userId, arr);
      }
      arr.push(loc);
      if (loc.isDeviated) {
        deviationCounts.set(loc.userId, (deviationCounts.get(loc.userId) ?? 0) + 1);
      }
    }

    type UserRow = { id: string; name: string; avatar: string | null };
    const userRows: UserRow[] = await prisma.user.findMany({
      where: { id: { in: Array.from(byRider.keys()) } },
      select: { id: true, name: true, avatar: true },
    });
    const userMeta = new Map<string, UserRow>(
      userRows.map((u: UserRow) => [u.id, u])
    );

    // ── Splits ───────────────────────────────────────────────────────────
    const splits = computeSplits(
      leadTrack.map((p) => ({ ...p })),
      profile.length >= 2 ? profile : null,
      1
    );

    // ── Climb stats ──────────────────────────────────────────────────────
    const climb = computeClimbStats(profile.length >= 2 ? profile : null);

    // ── Elevation summary ────────────────────────────────────────────────
    const elevation = summarizeElevation(profile.length >= 2 ? profile : null);

    // ── Cohesion ─────────────────────────────────────────────────────────
    const cohesionInput: CohesionInputRider[] = Array.from(byRider.entries()).map(
      ([userId, pts]) => ({
        userId,
        points: pts.map((p: RiderLocRow) => ({
          lat: p.lat,
          lng: p.lng,
          recordedAt: p.recordedAt,
        })),
      })
    );
    const windowStart = session.startedAt ?? session.createdAt;
    const windowEnd = session.endedAt ?? new Date();
    const cohesion = computeCohesion(
      session.leadRiderId,
      cohesionInput,
      windowStart,
      windowEnd,
      deviationCounts
    );

    // ── Leaderboard ──────────────────────────────────────────────────────
    const leaderboard: LeaderboardEntry[] = [];
    for (const [userId, pts] of byRider.entries()) {
      if (pts.length < 2) continue;
      const u = userMeta.get(userId);
      const distanceKm =
        Math.round(
          pathDistanceKm(pts.map((p: RiderLocRow) => ({ lat: p.lat, lng: p.lng }))) *
            10
        ) / 10;
      const elapsedMin =
        (pts[pts.length - 1].recordedAt.getTime() -
          pts[0].recordedAt.getTime()) /
        60_000;
      // Average speed using whatever we can measure from samples — coarse but
      // comparable across riders. Distance ÷ elapsed-time of recordings.
      const avgSpeedKmh =
        elapsedMin > 0
          ? Math.round(((distanceKm / elapsedMin) * 60) * 10) / 10
          : 0;
      let maxSpeed = 0;
      for (const p of pts) {
        if (p.speed != null && p.speed > maxSpeed && p.speed <= 220) {
          maxSpeed = p.speed;
        }
      }
      leaderboard.push({
        userId,
        name: u?.name ?? "Unknown rider",
        avatar: u?.avatar ?? null,
        distanceKm,
        movingMinutes: Math.round(elapsedMin),
        avgSpeedKmh,
        maxSpeedKmh: Math.round(maxSpeed * 10) / 10,
        pointCount: pts.length,
        deviationCount: deviationCounts.get(userId) ?? 0,
        isLead: userId === session.leadRiderId,
        isSweep: userId === session.sweepRiderId,
      });
    }
    leaderboard.sort((a, b) => b.distanceKm - a.distanceKm);

    return NextResponse.json({
      splits,
      climb,
      elevation,
      cohesion,
      leaderboard,
    });
  } catch (error) {
    console.error("[T2W] Analytics error:", error);
    return NextResponse.json(
      { error: "Failed to compute analytics" },
      { status: 500 }
    );
  }
}
