import { NextRequest, NextResponse, after } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { safeJsonParse } from "@/lib/json-utils";
import { decimatePath } from "@/lib/geo-utils";
import { fetchElevationStats } from "@/lib/elevation";

// Cap returned path size. We fetch all points and decimate evenly along
// distance so the visible polyline still covers the whole route — never
// silently drops the oldest portion (which the previous take:2000 did).
const MAX_PATH_POINTS = 2000;

// GET /api/rides/[id]/live - fetch live session state + rider locations
// ?since=<ISO timestamp>  — when provided, leadPath only includes points recorded
//   after that timestamp (delta mode). The client appends to its existing path.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: rideId } = await params;
    const sinceParam = req.nextUrl.searchParams.get("since");
    const sinceDate = sinceParam ? new Date(sinceParam) : null;

    const session = await prisma.liveRideSession.findUnique({
      where: { rideId },
      include: {
        breaks: { orderBy: { startedAt: "desc" } },
      },
    });

    if (!session) {
      return NextResponse.json({ session: null, riders: [], leadPath: [] });
    }

    // Get latest location per rider (subquery: max recordedAt per userId)
    const latestLocations = await prisma.$queryRaw<
      {
        id: string;
        userId: string;
        lat: number;
        lng: number;
        speed: number | null;
        heading: number | null;
        isDeviated: boolean;
        recordedAt: Date;
      }[]
    >`
      SELECT DISTINCT ON ("userId")
        id, "userId", lat, lng, speed, heading, "isDeviated", "recordedAt"
      FROM "LiveRideLocation"
      WHERE "sessionId" = ${session.id}
      ORDER BY "userId", "recordedAt" DESC
    `;

    // Get user names/avatars for the located riders
    const userIds = latestLocations.map((l) => l.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, avatar: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const riders = latestLocations.map((loc) => {
      const u = userMap.get(loc.userId);
      return {
        userId: loc.userId,
        userName: u?.name || "Unknown",
        userAvatar: u?.avatar || undefined,
        lat: loc.lat,
        lng: loc.lng,
        speed: loc.speed,
        heading: loc.heading,
        isDeviated: loc.isDeviated,
        isLead: loc.userId === session.leadRiderId,
        isSweep: loc.userId === session.sweepRiderId,
        recordedAt: loc.recordedAt.toISOString(),
      };
    });

    // Resolve the lead rider's path and the requesting user's own path.
    // - Delta mode (?since=): only points newer than the client's cursor.
    // - Full mode: fetch every point, then decimate evenly along distance to
    //   MAX_PATH_POINTS so the visible polyline always spans the whole route.
    // myPath is skipped when the requesting user IS the lead — same data.
    const [leadPath, myPath] = await Promise.all([
      session.leadRiderId
        ? loadUserPath(session.id, session.leadRiderId, sinceDate)
        : Promise.resolve([]),
      session.leadRiderId === user.id
        ? Promise.resolve([])
        : loadUserPath(session.id, user.id, sinceDate),
    ]);

    return NextResponse.json({
      session: {
        id: session.id,
        rideId: session.rideId,
        status: session.status,
        startedAt: session.startedAt?.toISOString(),
        endedAt: session.endedAt?.toISOString(),
        leadRiderId: session.leadRiderId,
        sweepRiderId: session.sweepRiderId,
        plannedRoute: session.plannedRoute
          ? safeJsonParse(session.plannedRoute, undefined)
          : undefined,
        breaks: session.breaks.map((b) => ({
          id: b.id,
          startedAt: b.startedAt.toISOString(),
          endedAt: b.endedAt?.toISOString(),
          reason: b.reason,
        })),
      },
      riders,
      leadPath,
      myPath,
    });
  } catch (error) {
    console.error("[T2W] Live session GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch live session" },
      { status: 500 }
    );
  }
}

/**
 * Load a single rider's GPS path for a session.
 *
 *   - Delta mode (sinceDate set): returns only points newer than the cursor;
 *     the client appends them to its existing polyline.
 *   - Full mode (no sinceDate): returns the full path, evenly decimated to
 *     MAX_PATH_POINTS so a multi-hour ride doesn't lose its early portion.
 */
async function loadUserPath(
  sessionId: string,
  userId: string,
  sinceDate: Date | null
): Promise<{ lat: number; lng: number; recordedAt: string; speed: number | null; accuracy: number | null }[]> {
  if (sinceDate) {
    const newPoints = await prisma.liveRideLocation.findMany({
      where: { sessionId, userId, recordedAt: { gt: sinceDate } },
      orderBy: { recordedAt: "asc" },
      select: { lat: true, lng: true, recordedAt: true, speed: true, accuracy: true },
    });
    return newPoints.map((l) => ({
      lat: l.lat,
      lng: l.lng,
      recordedAt: l.recordedAt.toISOString(),
      speed: l.speed,
      accuracy: l.accuracy,
    }));
  }

  const all = await prisma.liveRideLocation.findMany({
    where: { sessionId, userId },
    orderBy: { recordedAt: "asc" },
    select: { lat: true, lng: true, recordedAt: true, speed: true, accuracy: true },
  });
  // decimatePath is generic and preserves all fields on retained points, so
  // speed/accuracy travel through to the renderer without an extra pass.
  const decimated = decimatePath(all, MAX_PATH_POINTS);
  return decimated.map((l) => ({
    lat: l.lat,
    lng: l.lng,
    recordedAt: l.recordedAt.toISOString(),
    speed: l.speed,
    accuracy: l.accuracy,
  }));
}

// POST /api/rides/[id]/live - control session (start/pause/resume/end)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (
      !user ||
      (user.role !== "superadmin" && user.role !== "core_member")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (user.role === "core_member") {
      const { getRolePermissions } = await import("@/lib/role-permissions");
      const rolePerms = await getRolePermissions();
      if (!rolePerms.core_member.canControlLiveTracking) {
        return NextResponse.json({ error: "Core members do not have permission to control live tracking" }, { status: 403 });
      }
    }

    const { id: rideId } = await params;
    const { action } = await req.json();

    const ride = await prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride) {
      return NextResponse.json({ error: "Ride not found" }, { status: 404 });
    }

    if (action === "start") {
      // Check if session already exists
      const existing = await prisma.liveRideSession.findUnique({
        where: { rideId },
      });
      if (existing && existing.status !== "ended") {
        return NextResponse.json(
          { error: "Session already active" },
          { status: 400 }
        );
      }

      // Fuzzy-match lead/sweep rider names to user accounts (in parallel)
      const [leadRiderId, sweepRiderId] = await Promise.all([
        matchRiderToUser(ride.leadRider),
        matchRiderToUser(ride.sweepRider),
      ]);

      // Parse planned route from ride.route (JSON array of place names or coords)
      let plannedRoute: string | null = null;
      try {
        const routeData = JSON.parse(ride.route);
        // If route contains lat/lng objects, store as-is
        if (
          Array.isArray(routeData) &&
          routeData.length > 0 &&
          typeof routeData[0] === "object" &&
          "lat" in routeData[0]
        ) {
          plannedRoute = JSON.stringify(routeData);
        }
      } catch {
        // route is not parseable as coords, leave null
      }

      if (existing && existing.status === "ended") {
        // Re-start: update existing session
        const session = await prisma.liveRideSession.update({
          where: { rideId },
          data: {
            status: "live",
            startedAt: new Date(),
            endedAt: null,
            startedBy: user.id,
            leadRiderId,
            sweepRiderId,
            plannedRoute,
          },
        });
        return NextResponse.json({ session, action: "restarted" });
      }

      const session = await prisma.liveRideSession.create({
        data: {
          rideId,
          status: "live",
          startedAt: new Date(),
          startedBy: user.id,
          leadRiderId,
          sweepRiderId,
          plannedRoute,
        },
      });

      // Update ride status to ongoing
      await prisma.ride.update({
        where: { id: rideId },
        data: { status: "ongoing" },
      });

      return NextResponse.json({ session, action: "started" });
    }

    // For pause/resume/end, session must exist
    const session = await prisma.liveRideSession.findUnique({
      where: { rideId },
    });
    if (!session) {
      return NextResponse.json(
        { error: "No active session" },
        { status: 404 }
      );
    }

    if (action === "pause") {
      const updated = await prisma.liveRideSession.update({
        where: { rideId },
        data: { status: "paused" },
      });
      return NextResponse.json({ session: updated, action: "paused" });
    }

    if (action === "resume") {
      const updated = await prisma.liveRideSession.update({
        where: { rideId },
        data: { status: "live" },
      });
      return NextResponse.json({ session: updated, action: "resumed" });
    }

    if (action === "end") {
      const endedAt = new Date();
      // Atomically close the session, auto-close any still-open breaks so
      // metrics don't count hours of forgotten "break time", and mark the
      // ride as completed — all in one transaction.
      const updated = await prisma.$transaction(async (tx) => {
        const upd = await tx.liveRideSession.update({
          where: { rideId },
          data: { status: "ended", endedAt },
        });
        await tx.liveRideBreak.updateMany({
          where: { sessionId: session.id, endedAt: null },
          data: { endedAt },
        });
        await tx.ride.update({
          where: { id: rideId },
          data: { status: "completed" },
        });
        return upd;
      });

      // Backfill elevation gain/loss in the background. Capture session.id
      // up front — getCurrentUser/cookies are not available inside after().
      const sessionIdForElevation = session.id;
      after(async () => {
        try {
          const fresh = await prisma.liveRideSession.findUnique({
            where: { id: sessionIdForElevation },
            select: {
              id: true,
              leadRiderId: true,
              elevationGainM: true,
            },
          });
          // Idempotency guard — never re-bill the Elevation API on retry.
          if (!fresh || fresh.elevationGainM != null) return;

          // Prefer the lead rider's path; fall back to the most-tracked rider
          // (covers solo rides where leadRiderId never matched).
          let pathUserId = fresh.leadRiderId;
          if (!pathUserId) {
            const top = await prisma.liveRideLocation.groupBy({
              by: ["userId"],
              where: { sessionId: sessionIdForElevation },
              _count: { _all: true },
              orderBy: { _count: { userId: "desc" } },
              take: 1,
            });
            pathUserId = top[0]?.userId ?? null;
          }
          if (!pathUserId) return;

          const points = await prisma.liveRideLocation.findMany({
            where: { sessionId: sessionIdForElevation, userId: pathUserId },
            orderBy: { recordedAt: "asc" },
            select: { lat: true, lng: true },
          });
          const stats = await fetchElevationStats(points);
          if (!stats) return;

          await prisma.liveRideSession.update({
            where: { id: sessionIdForElevation },
            data: {
              elevationGainM: stats.gainM,
              elevationLossM: stats.lossM,
            },
          });
        } catch (err) {
          console.error("[T2W] Elevation backfill failed:", err);
        }
      });

      return NextResponse.json({ session: updated, action: "ended" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("[T2W] Live session POST error:", error);
    return NextResponse.json(
      { error: "Failed to control live session" },
      { status: 500 }
    );
  }
}

/** Fuzzy-match a rider name (from Ride model) to a User account */
async function matchRiderToUser(
  riderName: string
): Promise<string | null> {
  if (!riderName) return null;
  const normalized = riderName.toLowerCase().trim();

  // Try exact match first
  const exact = await prisma.user.findFirst({
    where: { name: { equals: normalized, mode: "insensitive" } },
    select: { id: true },
  });
  if (exact) return exact.id;

  // Try contains match
  const partial = await prisma.user.findFirst({
    where: { name: { contains: normalized, mode: "insensitive" } },
    select: { id: true },
  });
  if (partial) return partial.id;

  // Try matching via RiderProfile
  const profile = await prisma.riderProfile.findFirst({
    where: { name: { equals: normalized, mode: "insensitive" } },
    include: { linkedUsers: { select: { id: true }, take: 1 } },
  });
  if (profile?.linkedUsers[0]) return profile.linkedUsers[0].id;

  return null;
}
