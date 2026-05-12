import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/rides/[id]/live/smoothed?userId=<id>
// Returns the smoothed/gap-filled track for a rider (when one exists).
// Access matches the GPX download endpoint: superadmin / core_member /
// confirmed registrant; everyone else 403.
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

  const ride = await prisma.ride.findUnique({
    where: { id: rideId },
    select: {
      liveSession: { select: { id: true, smoothedAt: true, smoothedStats: true } },
      registrations: {
        where: { userId: user.id },
        select: { approvalStatus: true },
      },
    },
  });
  if (!ride?.liveSession) {
    return NextResponse.json({ error: "No live session" }, { status: 404 });
  }
  const isAdmin = user.role === "superadmin" || user.role === "core_member";
  const isConfirmed = ride.registrations.some(
    (r) => r.approvalStatus === "confirmed"
  );
  if (!isAdmin && !isConfirmed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const points = await prisma.liveRideLocationSmoothed.findMany({
    where: { sessionId: ride.liveSession.id, userId: queriedUserId },
    orderBy: { sourceOrder: "asc" },
    select: {
      lat: true,
      lng: true,
      recordedAt: true,
      isInterpolated: true,
      isSnapped: true,
    },
  });

  return NextResponse.json({
    smoothedAt: ride.liveSession.smoothedAt?.toISOString() ?? null,
    stats: ride.liveSession.smoothedStats
      ? safeParseJson(ride.liveSession.smoothedStats)
      : null,
    points: points.map((p) => ({
      lat: p.lat,
      lng: p.lng,
      recordedAt: p.recordedAt.toISOString(),
      isInterpolated: p.isInterpolated,
      isSnapped: p.isSnapped,
    })),
  });
}

function safeParseJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
