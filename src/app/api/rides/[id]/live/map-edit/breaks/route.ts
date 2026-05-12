import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireMapEditor, clipAuditDetails } from "@/lib/map-edit-auth";

// POST /api/rides/[id]/live/map-edit/breaks
// Body: { startedAt, endedAt?, reason? }
// Add a manual break post-hoc.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rideId } = await params;
  const gate = await requireMapEditor(rideId);
  if (!gate.ok) return gate.res;
  const { user, session } = gate;

  const body = (await req.json()) as {
    startedAt: string;
    endedAt?: string;
    reason?: string;
  };
  if (!body.startedAt) {
    return NextResponse.json({ error: "startedAt is required" }, { status: 400 });
  }

  const created = await prisma.$transaction(async (tx) => {
    const brk = await tx.liveRideBreak.create({
      data: {
        sessionId: session.id,
        startedAt: new Date(body.startedAt),
        endedAt: body.endedAt ? new Date(body.endedAt) : null,
        reason: body.reason || null,
      },
    });
    await tx.rideMapEdit.create({
      data: {
        sessionId: session.id,
        editedBy: user.id,
        editedByName: user.name,
        action: "break_added",
        details: clipAuditDetails({
          breakId: brk.id,
          startedAt: brk.startedAt.toISOString(),
          endedAt: brk.endedAt?.toISOString() ?? null,
          reason: brk.reason,
        }),
      },
    });
    return brk;
  });

  return NextResponse.json({ break: created });
}
