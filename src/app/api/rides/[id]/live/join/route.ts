import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// POST /api/rides/[id]/live/join - join the live session
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: rideId } = await params;

    const session = await prisma.liveRideSession.findUnique({
      where: { rideId },
    });

    if (!session) {
      return NextResponse.json(
        { error: "No live session for this ride" },
        { status: 404 }
      );
    }

    if (session.status === "ended") {
      return NextResponse.json(
        { error: "Session has ended" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      session: {
        id: session.id,
        rideId: session.rideId,
        status: session.status,
        startedAt: session.startedAt?.toISOString(),
        leadRiderId: session.leadRiderId,
        sweepRiderId: session.sweepRiderId,
      },
      isLead: user.id === session.leadRiderId,
      isSweep: user.id === session.sweepRiderId,
    });
  } catch (error) {
    console.error("[T2W] Live join error:", error);
    return NextResponse.json(
      { error: "Failed to join session" },
      { status: 500 }
    );
  }
}
