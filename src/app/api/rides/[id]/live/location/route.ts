import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isOnRoute, type LatLng } from "@/lib/geo-utils";

// POST /api/rides/[id]/live/location - submit GPS location
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: rideId } = await params;
    const { lat, lng, speed, heading, accuracy, recordedAt } = await req.json();

    if (typeof lat !== "number" || typeof lng !== "number") {
      return NextResponse.json(
        { error: "lat and lng are required numbers" },
        { status: 400 }
      );
    }

    // Optional client-supplied GPS recording time. Used for offline-queued
    // pings that flush long after they were captured — without it the DB
    // would stamp every flushed point at the reconnect instant. Reject
    // unparseable / future / >24h-old values rather than silently dropping
    // them, so a clock-skewed client can't corrupt the timeline.
    let recordedAtDate: Date | undefined;
    if (recordedAt !== undefined && recordedAt !== null) {
      if (typeof recordedAt !== "string") {
        return NextResponse.json(
          { error: "recordedAt must be an ISO date string" },
          { status: 400 }
        );
      }
      const parsed = new Date(recordedAt);
      const now = Date.now();
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ error: "Invalid recordedAt" }, { status: 400 });
      }
      if (parsed.getTime() > now + 60_000) {
        return NextResponse.json({ error: "recordedAt is in the future" }, { status: 400 });
      }
      if (now - parsed.getTime() > 24 * 60 * 60 * 1000) {
        return NextResponse.json(
          { error: "recordedAt is more than 24h old" },
          { status: 400 }
        );
      }
      recordedAtDate = parsed;
    }

    const session = await prisma.liveRideSession.findUnique({
      where: { rideId },
    });

    if (!session || session.status !== "live") {
      return NextResponse.json(
        { error: "No active live session" },
        { status: 400 }
      );
    }

    // Check deviation against planned route
    let isDeviated = false;
    if (session.plannedRoute) {
      try {
        const route: LatLng[] = JSON.parse(session.plannedRoute);
        if (route.length > 1) {
          isDeviated = !isOnRoute({ lat, lng }, route, 200);
        }
      } catch {
        console.error("[T2W] Invalid plannedRoute JSON for session", session.id);
      }
    }

    await prisma.liveRideLocation.create({
      data: {
        sessionId: session.id,
        userId: user.id,
        lat,
        lng,
        speed: speed ?? null,
        heading: heading ?? null,
        accuracy: accuracy ?? null,
        isDeviated,
        ...(recordedAtDate ? { recordedAt: recordedAtDate } : {}),
      },
    });

    return NextResponse.json({ success: true, isDeviated });
  } catch (error) {
    console.error("[T2W] Location submit error:", error);
    return NextResponse.json(
      { error: "Failed to submit location" },
      { status: 500 }
    );
  }
}
