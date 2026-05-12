import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireMapEditor, clipAuditDetails } from "@/lib/map-edit-auth";

const MAX_WAYPOINTS = 5000;

// PUT /api/rides/[id]/live/map-edit/planned-route
// Body: { waypoints: { lat: number; lng: number }[] }
// Super-admin only. Replaces LiveRideSession.plannedRoute and audits the change.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rideId } = await params;
  const gate = await requireMapEditor(rideId);
  if (!gate.ok) return gate.res;
  const { user, session } = gate;

  const body = (await req.json()) as { waypoints?: unknown };
  if (!Array.isArray(body.waypoints)) {
    return NextResponse.json(
      { error: "waypoints must be an array of { lat, lng }" },
      { status: 400 }
    );
  }
  if (body.waypoints.length > MAX_WAYPOINTS) {
    return NextResponse.json(
      { error: `Too many waypoints (max ${MAX_WAYPOINTS})` },
      { status: 400 }
    );
  }

  const waypoints: { lat: number; lng: number }[] = [];
  for (const w of body.waypoints) {
    if (!w || typeof w !== "object") {
      return NextResponse.json(
        { error: "Each waypoint must be an object" },
        { status: 400 }
      );
    }
    const { lat, lng } = w as { lat?: unknown; lng?: unknown };
    if (
      typeof lat !== "number" ||
      typeof lng !== "number" ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      return NextResponse.json(
        { error: "Invalid lat/lng in waypoints" },
        { status: 400 }
      );
    }
    waypoints.push({ lat, lng });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.liveRideSession.update({
      where: { id: session.id },
      data: {
        plannedRoute: JSON.stringify(waypoints),
        plannedRouteEditedAt: new Date(),
        plannedRouteEditedBy: user.id,
      },
    });
    await tx.rideMapEdit.create({
      data: {
        sessionId: session.id,
        editedBy: user.id,
        editedByName: user.name,
        action: "planned_route_replaced",
        details: clipAuditDetails({
          count: waypoints.length,
          first: waypoints.slice(0, 5),
          last: waypoints.slice(-5),
        }),
      },
    });
    return next;
  });

  return NextResponse.json({
    session: {
      id: updated.id,
      plannedRoute: waypoints,
      plannedRouteEditedAt: updated.plannedRouteEditedAt?.toISOString(),
      plannedRouteEditedBy: updated.plannedRouteEditedBy,
    },
  });
}
