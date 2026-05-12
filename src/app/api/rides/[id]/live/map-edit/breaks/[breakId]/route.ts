import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireMapEditor, clipAuditDetails } from "@/lib/map-edit-auth";

// PATCH /api/rides/[id]/live/map-edit/breaks/[breakId]
// Body: { startedAt?, endedAt?, reason? }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; breakId: string }> }
) {
  const { id: rideId, breakId } = await params;
  const gate = await requireMapEditor(rideId);
  if (!gate.ok) return gate.res;
  const { user, session } = gate;

  const body = (await req.json()) as {
    startedAt?: string;
    endedAt?: string | null;
    reason?: string | null;
  };

  const existing = await prisma.liveRideBreak.findUnique({
    where: { id: breakId },
  });
  if (!existing || existing.sessionId !== session.id) {
    return NextResponse.json({ error: "Break not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (body.startedAt !== undefined) data.startedAt = new Date(body.startedAt);
  if (body.endedAt !== undefined)
    data.endedAt = body.endedAt ? new Date(body.endedAt) : null;
  if (body.reason !== undefined) data.reason = body.reason;
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.liveRideBreak.update({
      where: { id: breakId },
      data,
    });
    await tx.rideMapEdit.create({
      data: {
        sessionId: session.id,
        editedBy: user.id,
        editedByName: user.name,
        action: "break_edited",
        details: clipAuditDetails({
          breakId,
          before: {
            startedAt: existing.startedAt.toISOString(),
            endedAt: existing.endedAt?.toISOString() ?? null,
            reason: existing.reason,
          },
          after: data,
        }),
      },
    });
    return next;
  });

  return NextResponse.json({ break: updated });
}

// DELETE /api/rides/[id]/live/map-edit/breaks/[breakId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; breakId: string }> }
) {
  const { id: rideId, breakId } = await params;
  const gate = await requireMapEditor(rideId);
  if (!gate.ok) return gate.res;
  const { user, session } = gate;

  const existing = await prisma.liveRideBreak.findUnique({
    where: { id: breakId },
  });
  if (!existing || existing.sessionId !== session.id) {
    return NextResponse.json({ error: "Break not found" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.liveRideBreak.delete({ where: { id: breakId } });
    await tx.rideMapEdit.create({
      data: {
        sessionId: session.id,
        editedBy: user.id,
        editedByName: user.name,
        action: "break_deleted",
        details: clipAuditDetails({
          breakId,
          startedAt: existing.startedAt.toISOString(),
          endedAt: existing.endedAt?.toISOString() ?? null,
          reason: existing.reason,
        }),
      },
    });
  });

  return NextResponse.json({ success: true });
}
