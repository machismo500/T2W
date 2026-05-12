import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { fetchElevationProfile } from "@/lib/elevation";

// GET /api/rides/[id]/live/elevation-profile?userId=<id>
// Returns the cached per-sample elevation profile for the lead rider's
// recorded track. If no cached value exists, calls Google Elevation API
// once (≤256 samples = 1 request) and persists the result on the session.
//
// Cache invalidation: any editor action that mutates the recorded track
// (trim, replace, smooth & fill, gpx upload) clears the cached profile.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: rideId } = await params;
  const queriedUserId = req.nextUrl.searchParams.get("userId");
  if (!queriedUserId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const session = await prisma.liveRideSession.findUnique({
    where: { rideId },
    select: { id: true, leadRiderId: true, elevationProfile: true },
  });
  if (!session) {
    return NextResponse.json({ error: "No live session" }, { status: 404 });
  }

  // Only the lead rider's profile is cached. Non-lead profiles can be
  // computed but aren't worth a column each — call this endpoint with the
  // lead rider id only.
  const isLead = queriedUserId === session.leadRiderId;
  if (isLead && session.elevationProfile) {
    try {
      const cached = JSON.parse(session.elevationProfile) as {
        distKm: number;
        elev: number;
      }[];
      return NextResponse.json({ profile: cached, cached: true });
    } catch {
      // fall through and recompute
    }
  }

  const points = await prisma.liveRideLocation.findMany({
    where: { sessionId: session.id, userId: queriedUserId },
    orderBy: { recordedAt: "asc" },
    select: { lat: true, lng: true },
  });
  if (points.length < 2) {
    return NextResponse.json({ profile: [], cached: false });
  }

  const profile = await fetchElevationProfile(points);
  if (!profile) {
    return NextResponse.json(
      { error: "Elevation API call failed or unavailable" },
      { status: 502 }
    );
  }

  if (isLead) {
    await prisma.liveRideSession.update({
      where: { id: session.id },
      data: { elevationProfile: JSON.stringify(profile) },
    });
  }

  return NextResponse.json({ profile, cached: false });
}
