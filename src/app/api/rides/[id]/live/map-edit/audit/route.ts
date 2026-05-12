import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/rides/[id]/live/map-edit/audit
// Returns the map-edit audit log for the ride's session. Super-admin or
// core_member (read-only).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "superadmin" && user.role !== "core_member")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id: rideId } = await params;
  const session = await prisma.liveRideSession.findUnique({
    where: { rideId },
    select: { id: true },
  });
  if (!session) {
    return NextResponse.json({ edits: [] });
  }
  const edits = await prisma.rideMapEdit.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json({
    edits: edits.map((e) => ({
      id: e.id,
      editedBy: e.editedBy,
      editedByName: e.editedByName,
      action: e.action,
      details: e.details ? safeParseJson(e.details) : null,
      createdAt: e.createdAt.toISOString(),
    })),
  });
}

function safeParseJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
