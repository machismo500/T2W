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
    const { lat, lng, speed, heading, accuracy } = await req.json();

    if (typeof lat !== "number" || typeof lng !== "number") {
      return NextResponse.json(
        { error: "lat and lng are required numbers" },
        { status: 400 }
      );
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
        // Invalid route data, skip deviation check
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
