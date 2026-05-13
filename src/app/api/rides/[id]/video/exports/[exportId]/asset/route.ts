import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { uploadBinary } from "@/lib/blob-upload";
import { isWorkerRequest } from "@/lib/worker-auth";

export const runtime = "nodejs";

// Cap a single asset upload at 60 MB. A 90s 1080p H.264 clip at CRF 22 lands
// around 12-18 MB, so this leaves comfortable headroom while still rejecting
// runaway uploads.
const MAX_BYTES = 60 * 1024 * 1024;

const ALLOWED_KINDS = new Set(["video", "thumbnail"]);
const KIND_TO_PATH: Record<string, { ext: string; contentType: string }> = {
  video: { ext: "mp4", contentType: "video/mp4" },
  thumbnail: { ext: "jpg", contentType: "image/jpeg" },
};

// POST /api/rides/[id]/video/exports/[exportId]/asset
//
// Worker-only multipart upload for the rendered MP4 + thumbnail. The render
// worker has no Vercel Blob token of its own, so it pushes the bytes here and
// receives a public URL it can stash in the export row via PATCH.
//
// Body: multipart/form-data with fields:
//   kind=video|thumbnail
//   file=<binary>
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; exportId: string }> }
) {
  if (!isWorkerRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: rideId, exportId } = await params;

  const row = await prisma.rideVideoExport.findUnique({
    where: { id: exportId },
    select: { id: true, rideId: true },
  });
  if (!row || row.rideId !== rideId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const form = await req.formData();
  const kind = String(form.get("kind") || "");
  if (!ALLOWED_KINDS.has(kind)) {
    return NextResponse.json(
      { error: "kind must be 'video' or 'thumbnail'" },
      { status: 400 }
    );
  }
  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `Asset exceeds ${MAX_BYTES} bytes` },
      { status: 413 }
    );
  }

  const { ext, contentType } = KIND_TO_PATH[kind];
  const bytes = Buffer.from(await file.arrayBuffer());
  const uploaded = await uploadBinary(bytes, {
    pathname: `ride-video/${rideId}/${exportId}-${kind}.${ext}`,
    contentType,
  });

  return NextResponse.json({
    url: uploaded.url,
    pathname: uploaded.pathname,
    contentType: uploaded.contentType,
    sizeBytes: uploaded.sizeBytes,
  });
}
