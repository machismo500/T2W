import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireMapEditor, clipAuditDetails } from "@/lib/map-edit-auth";

// PATCH /api/rides/[id]/live/map-edit/stats
// Body fields are all optional. Pass a number to set an override, or pass
// null to clear it (and fall back to computed). Fields not present in the
// body are untouched.
//
// Allowed fields:
//   distanceKmOverride?: number | null
//   avgSpeedKmhOverride?: number | null
//   maxSpeedKmhOverride?: number | null
//   movingMinutesOverride?: number | null   // integer minutes
//   elevationGainM?: number | null           // not an override — replaces the backfilled value
//   elevationLossM?: number | null
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rideId } = await params;
  const gate = await requireMapEditor(rideId);
  if (!gate.ok) return gate.res;
  const { user, session } = gate;

  const body = (await req.json()) as Record<string, unknown>;
  const data: Record<string, unknown> = {};
  const before: Record<string, unknown> = {};

  const setNumOverride = (key: string, integer = false) => {
    if (!(key in body)) return null;
    const v = body[key];
    if (v === null) {
      data[key] = null;
      before[key] = (session as unknown as Record<string, unknown>)[key];
      return null;
    }
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) {
      return `${key} must be a non-negative number or null`;
    }
    data[key] = integer ? Math.round(v) : v;
    before[key] = (session as unknown as Record<string, unknown>)[key];
    return null;
  };

  for (const field of [
    "distanceKmOverride",
    "avgSpeedKmhOverride",
    "maxSpeedKmhOverride",
  ]) {
    const err = setNumOverride(field);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
  }
  for (const field of ["movingMinutesOverride", "elevationGainM", "elevationLossM"]) {
    const err = setNumOverride(field, true);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.liveRideSession.update({
      where: { id: session.id },
      data,
    });
    await tx.rideMapEdit.create({
      data: {
        sessionId: session.id,
        editedBy: user.id,
        editedByName: user.name,
        action: "stats_changed",
        details: clipAuditDetails({ before, after: data }),
      },
    });
    return next;
  });

  return NextResponse.json({
    session: {
      id: updated.id,
      distanceKmOverride: updated.distanceKmOverride,
      avgSpeedKmhOverride: updated.avgSpeedKmhOverride,
      maxSpeedKmhOverride: updated.maxSpeedKmhOverride,
      movingMinutesOverride: updated.movingMinutesOverride,
      elevationGainM: updated.elevationGainM,
      elevationLossM: updated.elevationLossM,
    },
  });
}
