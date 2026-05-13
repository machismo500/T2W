import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { isOnRoute, type LatLng } from "@/lib/geo-utils";
import { apiError, apiOk } from "@/lib/api/v1/errors";
import { requireBearer } from "@/lib/api/v1/auth-guard";

type LocationPoint = {
  lat: number;
  lng: number;
  speed?: number | null;
  heading?: number | null;
  accuracy?: number | null;
  recordedAt?: string;
};

const MAX_BATCH = 200;
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

/**
 * POST /api/v1/rides/:id/live/location
 *
 * Accepts a batch of GPS breadcrumbs from mobile. The mobile client buffers
 * points locally (SQLite) and flushes in batches of up to 200 every ~30 s
 * (or on reconnect). Each point may carry its own `recordedAt` so reconnect
 * flushes don't collapse onto the wall-clock moment of upload.
 *
 * Body: { points: LocationPoint[] }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireBearer(req);
  if (!auth.ok) {
    return apiError("UNAUTHORIZED", "Authentication required");
  }

  const { id: rideId } = await params;
  const body = (await req.json().catch(() => null)) as { points?: LocationPoint[] } | null;
  if (!body || !Array.isArray(body.points) || body.points.length === 0) {
    return apiError("BAD_REQUEST", "points must be a non-empty array");
  }
  if (body.points.length > MAX_BATCH) {
    return apiError("BAD_REQUEST", `Batch exceeds maximum of ${MAX_BATCH}`);
  }

  const session = await prisma.liveRideSession.findUnique({ where: { rideId } });
  if (!session || session.status !== "live") {
    return apiError("CONFLICT", "No active live session");
  }

  const routePoints: LatLng[] | null = (() => {
    if (!session.plannedRoute) return null;
    try {
      const parsed = JSON.parse(session.plannedRoute) as LatLng[];
      return parsed.length > 1 ? parsed : null;
    } catch {
      return null;
    }
  })();

  const now = Date.now();
  const accepted: { sessionId: string; userId: string; lat: number; lng: number; speed: number | null; heading: number | null; accuracy: number | null; isDeviated: boolean; recordedAt?: Date }[] = [];
  const rejected: { index: number; reason: string }[] = [];

  body.points.forEach((p, i) => {
    if (typeof p.lat !== "number" || typeof p.lng !== "number") {
      rejected.push({ index: i, reason: "lat/lng required" });
      return;
    }
    let recordedAt: Date | undefined;
    if (p.recordedAt) {
      const parsed = new Date(p.recordedAt);
      if (Number.isNaN(parsed.getTime())) {
        rejected.push({ index: i, reason: "invalid recordedAt" });
        return;
      }
      if (parsed.getTime() > now + 60_000) {
        rejected.push({ index: i, reason: "recordedAt in the future" });
        return;
      }
      if (now - parsed.getTime() > TWENTY_FOUR_HOURS) {
        rejected.push({ index: i, reason: "recordedAt > 24h old" });
        return;
      }
      recordedAt = parsed;
    }

    const isDeviated = routePoints
      ? !isOnRoute({ lat: p.lat, lng: p.lng }, routePoints, 200)
      : false;

    accepted.push({
      sessionId: session.id,
      userId: auth.user.id,
      lat: p.lat,
      lng: p.lng,
      speed: p.speed ?? null,
      heading: p.heading ?? null,
      accuracy: p.accuracy ?? null,
      isDeviated,
      ...(recordedAt ? { recordedAt } : {}),
    });
  });

  if (accepted.length > 0) {
    await prisma.liveRideLocation.createMany({ data: accepted });
  }

  return apiOk({
    accepted: accepted.length,
    rejected,
    anyDeviation: accepted.some((p) => p.isDeviated),
  });
}
