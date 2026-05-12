import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireMapEditor, clipAuditDetails } from "@/lib/map-edit-auth";

const MAX_DELETE_ROWS = 50_000;

// DELETE /api/rides/[id]/live/map-edit/track-points
// Body: { pointIds?: string[]; userId?: string; before?: ISO; after?: ISO }
// Bulk-delete LiveRideLocation rows for this session. Super-admin only.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rideId } = await params;
  const gate = await requireMapEditor(rideId);
  if (!gate.ok) return gate.res;
  const { user, session } = gate;

  const body = (await req.json().catch(() => ({}))) as {
    pointIds?: string[];
    userId?: string;
    before?: string;
    after?: string;
  };

  const hasIds = Array.isArray(body.pointIds) && body.pointIds.length > 0;
  const hasRange = Boolean(body.userId) && (body.before || body.after);
  if (!hasIds && !hasRange) {
    return NextResponse.json(
      {
        error:
          "Provide either pointIds[] or { userId, before?/after? } to scope the delete",
      },
      { status: 400 }
    );
  }

  const where: {
    sessionId: string;
    id?: { in: string[] };
    userId?: string;
    recordedAt?: { lt?: Date; gt?: Date };
  } = { sessionId: session.id };

  if (hasIds) {
    where.id = { in: body.pointIds! };
  } else {
    where.userId = body.userId!;
    if (body.before || body.after) {
      where.recordedAt = {};
      if (body.before) where.recordedAt.lt = new Date(body.before);
      if (body.after) where.recordedAt.gt = new Date(body.after);
    }
  }

  const matchCount = await prisma.liveRideLocation.count({ where });
  if (matchCount > MAX_DELETE_ROWS) {
    return NextResponse.json(
      { error: `Too many points to delete in one call (matched ${matchCount}, max ${MAX_DELETE_ROWS})` },
      { status: 400 }
    );
  }

  const deleted = await prisma.$transaction(async (tx) => {
    const result = await tx.liveRideLocation.deleteMany({ where });
    // Trimming changes total elevation gain/loss along the path — drop the
    // cached profile so the next view refetches.
    await tx.liveRideSession.update({
      where: { id: session.id },
      data: { elevationProfile: null },
    });
    await tx.rideMapEdit.create({
      data: {
        sessionId: session.id,
        editedBy: user.id,
        editedByName: user.name,
        action: "track_points_deleted",
        details: clipAuditDetails({
          deletedCount: result.count,
          mode: hasIds ? "by_ids" : "by_range",
          pointIds: hasIds ? body.pointIds!.slice(0, 20) : undefined,
          userId: body.userId,
          before: body.before,
          after: body.after,
        }),
      },
    });
    return result;
  });

  return NextResponse.json({ deleted: deleted.count });
}
