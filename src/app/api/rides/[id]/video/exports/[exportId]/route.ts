import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isWorkerRequest } from "@/lib/worker-auth";

// GET /api/rides/[id]/video/exports/[exportId] — poll status.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; exportId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: rideId, exportId } = await params;
  const row = await prisma.rideVideoExport.findUnique({
    where: { id: exportId },
  });
  if (!row || row.rideId !== rideId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const isAdmin = user.role === "superadmin" || user.role === "core_member";
  if (!isAdmin && row.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({ export: row });
}

// PATCH /api/rides/[id]/video/exports/[exportId]
// Body: { videoUrl, thumbnailUrl, durationSec, fileSizeBytes, status, error? }
// Called by the renderer (browser MediaRecorder or external worker) when done.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; exportId: string }> }
) {
  const workerCall = isWorkerRequest(req);
  const user = workerCall ? null : await getCurrentUser();
  if (!workerCall && !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: rideId, exportId } = await params;
  const row = await prisma.rideVideoExport.findUnique({
    where: { id: exportId },
  });
  if (!row || row.rideId !== rideId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!workerCall && user) {
    const isAdmin = user.role === "superadmin" || user.role === "core_member";
    if (!isAdmin && row.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const body = (await req.json()) as {
    videoUrl?: string;
    thumbnailUrl?: string;
    durationSec?: number;
    fileSizeBytes?: number;
    status?: "queued" | "rendering" | "ready" | "failed";
    error?: string | null;
  };

  const data: Record<string, unknown> = {};
  if (body.videoUrl !== undefined) data.videoUrl = body.videoUrl;
  if (body.thumbnailUrl !== undefined) data.thumbnailUrl = body.thumbnailUrl;
  if (body.durationSec !== undefined) data.durationSec = body.durationSec;
  if (body.fileSizeBytes !== undefined) data.fileSizeBytes = body.fileSizeBytes;
  if (body.status !== undefined) data.status = body.status;
  if (body.error !== undefined) data.error = body.error;
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const updated = await prisma.rideVideoExport.update({
    where: { id: exportId },
    data,
  });
  return NextResponse.json({ export: updated });
}
