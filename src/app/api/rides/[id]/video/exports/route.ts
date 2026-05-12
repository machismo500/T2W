import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const WORKER_URL = process.env.RIDE_VIDEO_WORKER_URL;
const WORKER_SECRET = process.env.RIDE_VIDEO_WORKER_SECRET || "";

// GET /api/rides/[id]/video/exports
// List the calling user's video exports for this ride (admins see all).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: rideId } = await params;
  const isAdmin = user.role === "superadmin" || user.role === "core_member";
  const exports = await prisma.rideVideoExport.findMany({
    where: { rideId, ...(isAdmin ? {} : { userId: user.id }) },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ exports });
}

// POST /api/rides/[id]/video/exports
// Body: { orientation: "landscape" | "portrait"; resolution?: "1080p" }
// Creates a queued export. If RIDE_VIDEO_WORKER_URL is set, forwards to it.
// Otherwise the row sits at "queued" and the client renders + PATCHes when done.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: rideId } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    orientation?: "landscape" | "portrait";
    resolution?: string;
  };
  const orientation = body.orientation === "portrait" ? "portrait" : "landscape";
  const resolution = body.resolution || "1080p";

  // Only registrants and admins can request a video for the ride.
  const ride = await prisma.ride.findUnique({
    where: { id: rideId },
    select: {
      id: true,
      registrations: {
        where: { userId: user.id },
        select: { approvalStatus: true },
      },
    },
  });
  if (!ride) {
    return NextResponse.json({ error: "Ride not found" }, { status: 404 });
  }
  const isAdmin = user.role === "superadmin" || user.role === "core_member";
  const isRegistrant = ride.registrations.some(
    (r) => r.approvalStatus !== "rejected"
  );
  if (!isAdmin && !isRegistrant) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const row = await prisma.rideVideoExport.create({
    data: {
      rideId,
      userId: user.id,
      orientation,
      resolution,
      status: "queued",
    },
  });

  // Best-effort hand-off to an external worker. The worker is expected to
  // render the MP4 (using a headless browser hitting /ride/[id]/relive?headless=1)
  // and PATCH the export row back with the resulting Blob URL.
  if (WORKER_URL) {
    try {
      await fetch(WORKER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(WORKER_SECRET ? { Authorization: `Bearer ${WORKER_SECRET}` } : {}),
        },
        body: JSON.stringify({
          exportId: row.id,
          rideId,
          orientation,
          resolution,
        }),
      });
    } catch (err) {
      console.error("[T2W] Video worker dispatch failed:", err);
    }
  }

  return NextResponse.json({ export: row });
}
