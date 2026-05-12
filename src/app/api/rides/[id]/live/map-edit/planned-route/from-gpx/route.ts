import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/db";
import { requireMapEditor, clipAuditDetails } from "@/lib/map-edit-auth";
import { parseGpx, gpxDistanceKm, MAX_GPX_BYTES } from "@/lib/gpx";

// POST /api/rides/[id]/live/map-edit/planned-route/from-gpx
// multipart/form-data: `file` (GPX). Replaces the session's planned route.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rideId } = await params;
  const gate = await requireMapEditor(rideId);
  if (!gate.ok) return gate.res;
  const { user, session } = gate;

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (file.size > MAX_GPX_BYTES) {
    return NextResponse.json(
      { error: "GPX file too large (max 5 MB)" },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let parsed;
  try {
    parsed = parseGpx(buffer);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid GPX" },
      { status: 400 }
    );
  }
  if (parsed.points.length < 2) {
    return NextResponse.json(
      { error: "GPX must contain at least 2 points" },
      { status: 400 }
    );
  }

  const waypoints = parsed.points.map((p) => ({ lat: p.lat, lng: p.lng }));
  const distanceKm = gpxDistanceKm(parsed.points);

  let blobUrl = "";
  try {
    const blob = await put(
      `rides/${rideId}/gpx/planned-${Date.now()}-${file.name}`,
      buffer,
      { access: "public", contentType: "application/gpx+xml" }
    );
    blobUrl = blob.url;
  } catch (err) {
    console.error("[T2W] GPX blob upload failed:", err);
    // Continue without the blob — the parsed waypoints are the source of truth.
  }

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.liveRideSession.update({
      where: { id: session.id },
      data: {
        plannedRoute: JSON.stringify(waypoints),
        plannedRouteEditedAt: new Date(),
        plannedRouteEditedBy: user.id,
      },
    });
    let attachmentId: string | null = null;
    if (blobUrl) {
      const att = await tx.rideGpxAttachment.create({
        data: {
          rideId,
          sessionId: session.id,
          kind: "planned",
          fileUrl: blobUrl,
          filename: file.name,
          uploadedBy: user.id,
          pointCount: parsed.points.length,
          distanceKm,
        },
      });
      attachmentId = att.id;
    }
    await tx.rideMapEdit.create({
      data: {
        sessionId: session.id,
        editedBy: user.id,
        editedByName: user.name,
        action: "planned_route_replaced",
        details: clipAuditDetails({
          source: "gpx_upload",
          filename: file.name,
          pointCount: parsed.points.length,
          distanceKm,
          attachmentId,
        }),
      },
    });
    return { updated, attachmentId };
  });

  return NextResponse.json({
    waypointCount: waypoints.length,
    distanceKm,
    attachmentId: result.attachmentId,
    plannedRouteEditedAt: result.updated.plannedRouteEditedAt?.toISOString(),
  });
}
