import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireMapEditor, clipAuditDetails } from "@/lib/map-edit-auth";
import { snapToRoads, getRoadDirections, type LatLng } from "@/lib/roads-api";

// Gaps shorter than this are treated as normal sampling jitter and ignored.
const GAP_THRESHOLD_SECONDS = 60;
// Gaps longer than this are too risky to fill — phone was probably off for
// hours, and we don't want to invent half a day of pretend riding. The
// renderer will draw a dashed line across these stretches instead.
const MAX_GAP_SECONDS = 4 * 60 * 60;
// Cap the number of synthetic points we add per gap so a Directions response
// for a very long road segment doesn't dominate the saved track.
const MAX_FILL_POINTS_PER_GAP = 500;

interface SmoothStats {
  rawCount: number;
  snappedCount: number;
  interpolatedCount: number;
  gapsFilled: number;
  gapsSkipped: number;
  gapsTotalSeconds: number;
  movedPercent: number;
}

// POST /api/rides/[id]/live/map-edit/smooth-track
// Body: { userId: string }
// Runs the Roads + Directions pipeline for that rider and writes the result
// to LiveRideLocationSmoothed. Idempotent — re-running drops the previous
// smoothed series for the same (session, userId) before inserting the new one.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rideId } = await params;
  const gate = await requireMapEditor(rideId);
  if (!gate.ok) return gate.res;
  const { user, session } = gate;

  const { userId } = (await req.json()) as { userId?: string };
  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const raw = await prisma.liveRideLocation.findMany({
    where: { sessionId: session.id, userId },
    orderBy: { recordedAt: "asc" },
    select: { lat: true, lng: true, speed: true, recordedAt: true },
  });

  if (raw.length < 2) {
    return NextResponse.json(
      { error: "Not enough recorded points to smooth (need at least 2)" },
      { status: 400 }
    );
  }

  let snapped;
  try {
    snapped = await snapToRoads(raw.map((p) => ({ lat: p.lat, lng: p.lng })));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Roads API call failed" },
      { status: 502 }
    );
  }
  if (snapped.length === 0) {
    return NextResponse.json(
      { error: "Roads API returned no points" },
      { status: 502 }
    );
  }

  // Each snapped point either came from the original input (originalIndex
  // present) or was interpolated by Roads between two originals. Stamp each
  // snapped point with a recordedAt:
  //   - Original-index points: use the raw point's real recordedAt.
  //   - Interpolated points: linearly interpolate between the surrounding
  //     anchor times.
  type Stamped = {
    lat: number;
    lng: number;
    recordedAt: Date;
    isInterpolated: boolean;
    isSnapped: boolean;
  };
  const stamped: Stamped[] = [];
  let lastAnchorTime: number | null = null;
  for (let i = 0; i < snapped.length; i++) {
    const s = snapped[i];
    if (s.originalIndex !== undefined) {
      const raw_t = raw[s.originalIndex].recordedAt.getTime();
      // Backfill any pending interpolated points using linear time interp.
      const pendingStart = stamped.findIndex(
        (p) => p.isInterpolated && Number.isNaN(p.recordedAt.getTime())
      );
      if (pendingStart >= 0 && lastAnchorTime !== null) {
        const span = stamped.slice(pendingStart);
        const total = span.length + 1;
        for (let j = 0; j < span.length; j++) {
          const t = lastAnchorTime + ((j + 1) / total) * (raw_t - lastAnchorTime);
          span[j].recordedAt = new Date(t);
        }
      }
      const wasMoved =
        Math.abs(raw[s.originalIndex].lat - s.lat) > 1e-7 ||
        Math.abs(raw[s.originalIndex].lng - s.lng) > 1e-7;
      stamped.push({
        lat: s.lat,
        lng: s.lng,
        recordedAt: new Date(raw_t),
        isInterpolated: false,
        isSnapped: wasMoved,
      });
      lastAnchorTime = raw_t;
    } else {
      // Interpolated point — recordedAt placeholder, filled when next anchor
      // arrives. If no anchor follows, copy the previous anchor time.
      stamped.push({
        lat: s.lat,
        lng: s.lng,
        recordedAt: new Date(NaN),
        isInterpolated: true,
        isSnapped: false,
      });
    }
  }
  // Trailing interpolated points without a following anchor — pin to the
  // last anchor time so DB inserts don't fail.
  for (const p of stamped) {
    if (Number.isNaN(p.recordedAt.getTime()) && lastAnchorTime !== null) {
      p.recordedAt = new Date(lastAnchorTime);
    }
  }

  // Walk consecutive ANCHOR points and fill gaps along the road. Insertion
  // points are placed between the surrounding stamped rows.
  const withFills: Stamped[] = [];
  const stats: SmoothStats = {
    rawCount: raw.length,
    snappedCount: snapped.length,
    interpolatedCount: 0,
    gapsFilled: 0,
    gapsSkipped: 0,
    gapsTotalSeconds: 0,
    movedPercent: 0,
  };

  for (let i = 0; i < stamped.length; i++) {
    withFills.push(stamped[i]);
    if (i === stamped.length - 1) break;
    const cur = stamped[i];
    const next = stamped[i + 1];
    // Only fill across true anchor-to-anchor gaps; Roads already smoothed
    // intra-anchor segments.
    if (cur.isInterpolated || next.isInterpolated) continue;
    const dt = (next.recordedAt.getTime() - cur.recordedAt.getTime()) / 1000;
    if (dt <= GAP_THRESHOLD_SECONDS) continue;
    stats.gapsTotalSeconds += dt;
    if (dt > MAX_GAP_SECONDS) {
      stats.gapsSkipped++;
      continue;
    }
    let fill: LatLng[] = [];
    try {
      fill = await getRoadDirections(
        { lat: cur.lat, lng: cur.lng },
        { lat: next.lat, lng: next.lng }
      );
    } catch (err) {
      console.error("[T2W] Gap-fill Directions call failed:", err);
      stats.gapsSkipped++;
      continue;
    }
    // Drop the first and last points — they duplicate cur/next.
    let intermediate = fill.length > 2 ? fill.slice(1, -1) : [];
    if (intermediate.length > MAX_FILL_POINTS_PER_GAP) {
      const step = Math.ceil(intermediate.length / MAX_FILL_POINTS_PER_GAP);
      intermediate = intermediate.filter((_, idx) => idx % step === 0);
    }
    if (intermediate.length === 0) continue;
    const span = intermediate.length + 1;
    for (let k = 0; k < intermediate.length; k++) {
      const t =
        cur.recordedAt.getTime() +
        ((k + 1) / span) * (next.recordedAt.getTime() - cur.recordedAt.getTime());
      withFills.push({
        lat: intermediate[k].lat,
        lng: intermediate[k].lng,
        recordedAt: new Date(t),
        isInterpolated: true,
        isSnapped: false,
      });
    }
    stats.gapsFilled++;
    stats.interpolatedCount += intermediate.length;
  }

  // Also count Roads-interpolated points (between-anchor) as interpolated.
  stats.interpolatedCount += stamped.filter((p) => p.isInterpolated).length;
  const movedCount = stamped.filter((p) => p.isSnapped).length;
  stats.movedPercent = Math.round((movedCount / Math.max(1, snapped.length)) * 100);

  // Preview mode: skip persistence and return the proposed track so the
  // admin can inspect it on the map before committing. Useful for off-road
  // sections where Roads API might pull the polyline onto the wrong road.
  const previewMode = req.nextUrl.searchParams.get("preview") === "1";
  if (previewMode) {
    return NextResponse.json({
      preview: true,
      stats,
      points: withFills.map((p) => ({
        lat: p.lat,
        lng: p.lng,
        recordedAt: p.recordedAt.toISOString(),
        isInterpolated: p.isInterpolated,
        isSnapped: p.isSnapped,
      })),
    });
  }

  // Persist: drop any prior smoothed rows for this rider, insert the new
  // series, update session bookkeeping, and write an audit row.
  await prisma.$transaction(async (tx) => {
    await tx.liveRideLocationSmoothed.deleteMany({
      where: { sessionId: session.id, userId },
    });
    if (withFills.length > 0) {
      await tx.liveRideLocationSmoothed.createMany({
        data: withFills.map((p, idx) => ({
          sessionId: session.id,
          userId,
          lat: p.lat,
          lng: p.lng,
          speed: null,
          recordedAt: p.recordedAt,
          isInterpolated: p.isInterpolated,
          isSnapped: p.isSnapped,
          sourceOrder: idx,
        })),
      });
    }
    await tx.liveRideSession.update({
      where: { id: session.id },
      data: {
        smoothedAt: new Date(),
        smoothedBy: user.id,
        smoothedStats: JSON.stringify(stats),
      },
    });
    await tx.rideMapEdit.create({
      data: {
        sessionId: session.id,
        editedBy: user.id,
        editedByName: user.name,
        action: "track_smoothed",
        details: clipAuditDetails({ userId, stats }),
      },
    });
  });

  return NextResponse.json({ stats, points: withFills.length });
}

// DELETE /api/rides/[id]/live/map-edit/smooth-track
// Body: { userId: string }
// Drops the smoothed series for that rider so the map reverts to raw.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rideId } = await params;
  const gate = await requireMapEditor(rideId);
  if (!gate.ok) return gate.res;
  const { user, session } = gate;

  const { userId } = (await req.json().catch(() => ({}))) as {
    userId?: string;
  };
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const deleted = await tx.liveRideLocationSmoothed.deleteMany({
      where: { sessionId: session.id, userId },
    });
    await tx.rideMapEdit.create({
      data: {
        sessionId: session.id,
        editedBy: user.id,
        editedByName: user.name,
        action: "track_smoothed_reverted",
        details: clipAuditDetails({ userId, deletedCount: deleted.count }),
      },
    });
    return deleted;
  });

  return NextResponse.json({ deleted: result.count });
}
