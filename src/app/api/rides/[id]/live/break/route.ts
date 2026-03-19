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
      // Find the latest open break
      const openBreak = await prisma.liveRideBreak.findFirst({
        where: { sessionId: session.id, endedAt: null },
        orderBy: { startedAt: "desc" },
      });

      if (!openBreak) {
        return NextResponse.json(
          { error: "No active break to end" },
          { status: 400 }
        );
      }

      const updated = await prisma.liveRideBreak.update({
        where: { id: openBreak.id },
        data: { endedAt: new Date() },
      });

      // Resume the session
      await prisma.liveRideSession.update({
        where: { id: session.id },
        data: { status: "live" },
      });

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
