import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// POST /api/rides/[id]/live/break - start or end a break
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (
      !user ||
      (user.role !== "superadmin" && user.role !== "core_member")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (user.role === "core_member") {
      const { getRolePermissions } = await import("@/lib/role-permissions");
      const rolePerms = await getRolePermissions();
      if (!rolePerms.core_member.canControlLiveTracking) {
        return NextResponse.json(
          { error: "Core members do not have permission to control live tracking" },
          { status: 403 }
        );
      }
    }

    const { id: rideId } = await params;
    const { action, reason } = await req.json();

    const session = await prisma.liveRideSession.findUnique({
      where: { rideId },
    });

    if (!session || (session.status !== "live" && session.status !== "paused")) {
      return NextResponse.json(
        { error: "No active session" },
        { status: 400 }
      );
    }

    if (action === "start") {
      // Prevent overlapping breaks
      const existingOpenBreak = await prisma.liveRideBreak.findFirst({
        where: { sessionId: session.id, endedAt: null },
      });
      if (existingOpenBreak) {
        return NextResponse.json(
          { error: "A break is already active" },
          { status: 400 }
        );
      }

      const breakRecord = await prisma.liveRideBreak.create({
        data: {
          sessionId: session.id,
          reason: reason || null,
        },
      });

      // Pause the session during break
      await prisma.liveRideSession.update({
        where: { id: session.id },
        data: { status: "paused" },
      });

      return NextResponse.json({
        success: true,
        break: {
          id: breakRecord.id,
          startedAt: breakRecord.startedAt.toISOString(),
          reason: breakRecord.reason,
        },
      });
    }

    if (action === "end") {
      // Wrap find → close → resume in a transaction so two concurrent
      // "end" requests can't both close the same break and both flip
      // the session back to "live".
      const result = await prisma.$transaction(async (tx) => {
        const openBreak = await tx.liveRideBreak.findFirst({
          where: { sessionId: session.id, endedAt: null },
          orderBy: { startedAt: "desc" },
        });
        if (!openBreak) return { error: "NO_OPEN_BREAK" as const };

        // Guarded update — only closes if another request hasn't already
        // closed it. count === 0 means someone beat us to it.
        const closed = await tx.liveRideBreak.updateMany({
          where: { id: openBreak.id, endedAt: null },
          data: { endedAt: new Date() },
        });
        if (closed.count === 0) return { error: "NO_OPEN_BREAK" as const };

        const updated = await tx.liveRideBreak.findUnique({
          where: { id: openBreak.id },
        });

        const stillOpen = await tx.liveRideBreak.findFirst({
          where: { sessionId: session.id, endedAt: null },
        });
        if (!stillOpen) {
          await tx.liveRideSession.update({
            where: { id: session.id },
            data: { status: "live" },
          });
        }

        return { updated };
      });

      if ("error" in result) {
        return NextResponse.json(
          { error: "No active break to end" },
          { status: 400 }
        );
      }

      const updated = result.updated!;
      return NextResponse.json({
        success: true,
        break: {
          id: updated.id,
          startedAt: updated.startedAt.toISOString(),
          endedAt: updated.endedAt?.toISOString(),
          reason: updated.reason,
        },
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("[T2W] Break control error:", error);
    return NextResponse.json(
      { error: "Failed to control break" },
      { status: 500 }
    );
  }
}
