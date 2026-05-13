import { prisma } from "@/lib/db";
import { pathDistanceKm } from "@/lib/geo-utils";

/**
 * Per-ride badge tier names (mirrors the seed in scripts/seed-badges.ts).
 * Each name encodes its own threshold via the `Badge.minKm` column — the
 * column is multipurpose for per-ride badges (km, m, or km/h depending on
 * tier). Keep the threshold-interpretation logic here so the seed stays
 * declarative.
 */
const PER_RIDE_TIERS = ["RIDE_500K", "RIDE_2000M", "RIDE_70AVG"] as const;
type PerRideTier = (typeof PER_RIDE_TIERS)[number];

interface RiderRideStats {
  distanceKm: number;
  avgSpeedKmh: number;
  elevationGainM: number;
}

function meetsCriterion(tier: PerRideTier, stats: RiderRideStats): boolean {
  switch (tier) {
    case "RIDE_500K":
      return stats.distanceKm >= 500;
    case "RIDE_2000M":
      return stats.elevationGainM >= 2000;
    case "RIDE_70AVG":
      return stats.distanceKm >= 100 && stats.avgSpeedKmh >= 70;
  }
}

/**
 * Inspect every rider on the just-ended session and award any per-ride badges
 * they qualify for. Idempotent — the `@@unique([userId, badgeId])` constraint
 * means re-running the awarder on the same session is a no-op.
 *
 * Designed to run inside Next's `after()` hook on the live POST end action so
 * the response isn't blocked. Failures are logged and swallowed — a missed
 * badge isn't worth a 500.
 */
export async function awardPerRideBadgesForSession(sessionId: string): Promise<void> {
  const badges = await prisma.badge.findMany({
    where: { kind: "per_ride", tier: { in: [...PER_RIDE_TIERS] } },
    select: { id: true, tier: true },
  });
  if (badges.length === 0) return;

  // Pull the session's elevation total once — it's the same for every rider
  // since we backfill from the lead path. Per-rider elevation isn't
  // calculated yet; this is fine for the climber badge (it credits everyone
  // who completed the ride together).
  const session = await prisma.liveRideSession.findUnique({
    where: { id: sessionId },
    select: { rideId: true, elevationGainM: true },
  });
  if (!session) return;

  // Every distinct rider with at least one tracked point on this session.
  const riders = await prisma.liveRideLocation.groupBy({
    by: ["userId"],
    where: { sessionId },
    _count: { _all: true },
  });

  for (const rider of riders) {
    try {
      // Prefer the smoothed/gap-filled series — same source of truth the
      // metrics endpoint uses for the visible distance number. Falls back to
      // raw points for older sessions that never got smoothed.
      const [smoothed, raw, speedAgg] = await Promise.all([
        prisma.liveRideLocationSmoothed.findMany({
          where: { sessionId, userId: rider.userId },
          orderBy: { sourceOrder: "asc" },
          select: { lat: true, lng: true },
        }),
        prisma.liveRideLocation.findMany({
          where: { sessionId, userId: rider.userId },
          orderBy: { recordedAt: "asc" },
          select: { lat: true, lng: true },
        }),
        // Match the metrics endpoint's 220 km/h clamp so a single jittery
        // GPS fix can't earn a rider the Speed Demon badge.
        prisma.liveRideLocation.aggregate({
          where: {
            sessionId,
            userId: rider.userId,
            speed: { not: null, gt: 0, lte: 220 },
          },
          _avg: { speed: true },
        }),
      ]);
      const distancePoints = smoothed.length > 1 ? smoothed : raw;
      if (distancePoints.length < 2) continue;

      const riderStats: RiderRideStats = {
        distanceKm: pathDistanceKm(distancePoints),
        avgSpeedKmh: speedAgg._avg.speed ?? 0,
        elevationGainM: session.elevationGainM ?? 0,
      };

      for (const badge of badges) {
        if (!meetsCriterion(badge.tier as PerRideTier, riderStats)) continue;
        await prisma.userBadge.upsert({
          where: {
            userId_badgeId: { userId: rider.userId, badgeId: badge.id },
          },
          create: { userId: rider.userId, badgeId: badge.id },
          update: {},
        });
      }
    } catch (err) {
      console.error(
        `[T2W] Per-ride badge award failed (session=${sessionId}, user=${rider.userId}):`,
        err
      );
    }
  }
}
