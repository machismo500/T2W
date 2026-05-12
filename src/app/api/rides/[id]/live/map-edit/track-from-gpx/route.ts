import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/db";
import { requireMapEditor, clipAuditDetails } from "@/lib/map-edit-auth";
import { parseGpx, gpxDistanceKm, MAX_GPX_BYTES } from "@/lib/gpx";

// POST /api/rides/[id]/live/map-edit/track-from-gpx
// multipart/form-data: file (GPX), userId (target rider). Replaces that user's
// recorded LiveRideLocation rows for this session with points from the GPX.
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
  const targetUserId = form.get("userId");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (typeof targetUserId !== "string" || !targetUserId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
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

  let blobUrl = "";
  try {
    const blob = await put(
      `rides/${rideId}/gpx/recorded-${targetUserId}-${Date.now()}-${file.name}`,
      buffer,
      { access: "public", contentType: "application/gpx+xml" }
    );
    blobUrl = blob.url;
  } catch (err) {
    console.error("[T2W] GPX blob upload failed:", err);
  }

  const distanceKm = gpxDistanceKm(parsed.points);

  // Synthesize timestamps when the GPX has none, so the recorded path stays in
  // order. Use the session's start time when available, otherwise "now".
  const startTimestamp =
    session.startedAt?.getTime() ?? Date.now() - parsed.points.length * 5_000;

  const result = await prisma.$transaction(async (tx) => {
    const deleted = await tx.liveRideLocation.deleteMany({
      where: { sessionId: session.id, userId: targetUserId },
    });

    const rows = parsed.points.map((p, i) => ({
      sessionId: session.id,
      userId: targetUserId,
      lat: p.lat,
      lng: p.lng,
      speed: null as number | null,
      heading: null as number | null,
      accuracy: null as number | null,
      isDeviated: false,
      recordedAt: p.time
        ? new Date(p.time)
        : new Date(startTimestamp + i * 5_000),
    }));
    await tx.liveRideLocation.createMany({ data: rows });
    // Replacing the recorded track invalidates the cached elevation profile.
    await tx.liveRideSession.update({
      where: { id: session.id },
      data: { elevationProfile: null },
    });

    let attachmentId: string | null = null;
    if (blobUrl) {
      const att = await tx.rideGpxAttachment.create({
        data: {
          rideId,
          sessionId: session.id,
          kind: "recorded_replacement",
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
        action: "track_replaced_from_gpx",
        details: clipAuditDetails({
          targetUserId,
          filename: file.name,
          deletedCount: deleted.count,
          insertedCount: parsed.points.length,
          distanceKm,
          attachmentId,
        }),
      },
    });
    return {
      replaced: deleted.count,
      inserted: parsed.points.length,
      attachmentId,
    };
  });

  return NextResponse.json({
    inserted: result.inserted,
    replaced: result.replaced,
    attachmentId: result.attachmentId,
    distanceKm,
  });
}
