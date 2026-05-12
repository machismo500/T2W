import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireMapEditor, clipAuditDetails } from "@/lib/map-edit-auth";

// PATCH /api/rides/[id]/live/map-edit/session-meta
// Body: { leadRiderId?, sweepRiderId?, startedAt?, endedAt? }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rideId } = await params;
  const gate = await requireMapEditor(rideId);
  if (!gate.ok) return gate.res;
  const { user, session } = gate;

  const body = (await req.json()) as {
    leadRiderId?: string | null;
    sweepRiderId?: string | null;
    startedAt?: string | null;
    endedAt?: string | null;
  };

  const data: Record<string, unknown> = {};
  const before: Record<string, unknown> = {};
  if (body.leadRiderId !== undefined) {
    data.leadRiderId = body.leadRiderId;
    before.leadRiderId = session.leadRiderId;
  }
  if (body.sweepRiderId !== undefined) {
    data.sweepRiderId = body.sweepRiderId;
    before.sweepRiderId = session.sweepRiderId;
  }
  if (body.startedAt !== undefined) {
    data.startedAt = body.startedAt ? new Date(body.startedAt) : null;
    before.startedAt = session.startedAt?.toISOString();
  }
  if (body.endedAt !== undefined) {
    data.endedAt = body.endedAt ? new Date(body.endedAt) : null;
    before.endedAt = session.endedAt?.toISOString();
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
        action: "session_meta_changed",
        details: clipAuditDetails({ before, after: data }),
      },
    });
    return next;
  });

  return NextResponse.json({
    session: {
      id: updated.id,
      leadRiderId: updated.leadRiderId,
      sweepRiderId: updated.sweepRiderId,
      startedAt: updated.startedAt?.toISOString() ?? null,
      endedAt: updated.endedAt?.toISOString() ?? null,
    },
  });
}
