import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { safeJsonParse } from "@/lib/json-utils";

// GET /api/rides/[id]/live - fetch live session state + rider locations
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

    // Get lead rider's full path for route painting
    let leadPath: { lat: number; lng: number; recordedAt: string }[] = [];
    if (session.leadRiderId) {
      const leadLocations = await prisma.liveRideLocation.findMany({
        where: { sessionId: session.id, userId: session.leadRiderId },
        orderBy: { recordedAt: "asc" },
        select: { lat: true, lng: true, recordedAt: true },
      });
      leadPath = leadLocations.map((l) => ({
        lat: l.lat,
        lng: l.lng,
        recordedAt: l.recordedAt.toISOString(),
      }));
    }

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
    });
  } catch (error) {
    console.error("[T2W] Live session GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch live session" },
      { status: 500 }
    );
  }
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
      const updated = await prisma.liveRideSession.update({
        where: { rideId },
        data: { status: "ended", endedAt: new Date() },
      });

      // Update ride status to completed
      await prisma.ride.update({
        where: { id: rideId },
        data: { status: "completed" },
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
