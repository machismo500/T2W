import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getRolePermissions } from "@/lib/role-permissions";
import { safeJsonParse } from "@/lib/json-utils";
import { serializeGpx, type GpxPoint } from "@/lib/gpx";

// Cap GPX export size — 100k points × ~80 bytes/line ≈ 8 MB raw.
const MAX_EXPORT_POINTS = 100_000;

// GET /api/rides/[id]/live/gpx?path=lead|mine|planned&userId=<id>
// Returns the requested route as a GPX 1.1 attachment.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: rideId } = await params;
  const path = (req.nextUrl.searchParams.get("path") || "lead") as
    | "lead"
    | "mine"
    | "planned";
  const queriedUserId = req.nextUrl.searchParams.get("userId");

  const ride = await prisma.ride.findUnique({
    where: { id: rideId },
    include: {
      liveSession: true,
      registrations: {
        where: { userId: user.id },
        select: { id: true, approvalStatus: true },
      },
    },
  });
  if (!ride) {
    return NextResponse.json({ error: "Ride not found" }, { status: 404 });
  }
  if (!ride.liveSession) {
    return NextResponse.json(
      { error: "No live session for this ride" },
      { status: 404 }
    );
  }

  // Access rule: super-admin / core_member always; confirmed registrant
  // always; plain rider gated by canDownloadRideDocuments setting.
  const isAdmin =
    user.role === "superadmin" || user.role === "core_member";
  const isConfirmedRegistrant = ride.registrations.some(
    (r) => r.approvalStatus === "confirmed"
  );
  if (!isAdmin && !isConfirmedRegistrant) {
    const perms = await getRolePermissions();
    if (user.role !== "rider" || !perms.rider.canDownloadRideDocuments) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  let points: GpxPoint[] = [];
  let trackName = ride.title;

  if (path === "planned") {
    const planned =
      (safeJsonParse(ride.liveSession.plannedRoute ?? "[]", []) as {
        lat: number;
        lng: number;
      }[]) || [];
    points = planned.map((p) => ({ lat: p.lat, lng: p.lng }));
    trackName = `${ride.title} — Planned route`;
  } else {
    const targetUserId =
      path === "mine"
        ? user.id
        : queriedUserId || ride.liveSession.leadRiderId || user.id;
    if (path === "lead" && !ride.liveSession.leadRiderId && !queriedUserId) {
      return NextResponse.json(
        { error: "No lead rider tracked for this ride" },
        { status: 404 }
      );
    }
    const locations = await prisma.liveRideLocation.findMany({
      where: { sessionId: ride.liveSession.id, userId: targetUserId },
      orderBy: { recordedAt: "asc" },
      select: { lat: true, lng: true, recordedAt: true },
      take: MAX_EXPORT_POINTS,
    });
    points = locations.map((l) => ({
      lat: l.lat,
      lng: l.lng,
      time: l.recordedAt.toISOString(),
    }));
    trackName = `${ride.title} — ${
      path === "mine" ? "My ride" : path === "lead" ? "Lead rider" : "Rider"
    }`;
  }

  if (points.length === 0) {
    return NextResponse.json(
      { error: "No track points available for this path" },
      { status: 404 }
    );
  }

  const gpx = serializeGpx({
    name: trackName,
    trackName,
    points,
  });

  const filenameSafe = `${ride.title}-${path}`
    .replace(/[^\w\s.-]+/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80);

  return new NextResponse(gpx, {
    status: 200,
    headers: {
      "Content-Type": "application/gpx+xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filenameSafe}.gpx"`,
      "Cache-Control": "no-store",
    },
  });
}
