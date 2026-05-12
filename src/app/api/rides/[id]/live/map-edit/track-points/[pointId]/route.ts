import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireMapEditor, clipAuditDetails } from "@/lib/map-edit-auth";

// PATCH /api/rides/[id]/live/map-edit/track-points/[pointId]
// Body: { lat?, lng?, speed?, heading? }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; pointId: string }> }
) {
  const { id: rideId, pointId } = await params;
  const gate = await requireMapEditor(rideId);
  if (!gate.ok) return gate.res;
  const { user, session } = gate;

  const body = (await req.json()) as {
    lat?: number;
    lng?: number;
    speed?: number | null;
    heading?: number | null;
  };

  const existing = await prisma.liveRideLocation.findUnique({
    where: { id: pointId },
  });
  if (!existing || existing.sessionId !== session.id) {
    return NextResponse.json({ error: "Point not found" }, { status: 404 });
  }

  const data: {
    lat?: number;
    lng?: number;
    speed?: number | null;
    heading?: number | null;
  } = {};
  if (body.lat !== undefined) {
    if (typeof body.lat !== "number" || body.lat < -90 || body.lat > 90) {
      return NextResponse.json({ error: "Invalid lat" }, { status: 400 });
    }
    data.lat = body.lat;
  }
  if (body.lng !== undefined) {
    if (typeof body.lng !== "number" || body.lng < -180 || body.lng > 180) {
      return NextResponse.json({ error: "Invalid lng" }, { status: 400 });
    }
    data.lng = body.lng;
  }
  if (body.speed !== undefined) data.speed = body.speed;
  if (body.heading !== undefined) data.heading = body.heading;
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.liveRideLocation.update({
      where: { id: pointId },
      data,
    });
    await tx.rideMapEdit.create({
      data: {
        sessionId: session.id,
        editedBy: user.id,
        editedByName: user.name,
        action: "track_points_edited",
        details: clipAuditDetails({
          pointId,
          before: {
            lat: existing.lat,
            lng: existing.lng,
            speed: existing.speed,
            heading: existing.heading,
          },
          after: data,
        }),
      },
    });
    return next;
  });

  return NextResponse.json({ point: updated });
}
