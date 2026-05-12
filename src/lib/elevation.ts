// Google Maps Elevation API wrapper used for the post-ride backfill.
//
// Called once from the `end` action in src/app/api/rides/[id]/live/route.ts via
// after(), so it never blocks the End Ride response. Failures are swallowed —
// the UI hides the elevation card when the columns remain null.

import type { LatLng } from "./geo-utils";
import { decimatePath } from "./geo-utils";

const ELEVATION_ENDPOINT = "https://maps.googleapis.com/maps/api/elevation/json";

// Suppress sub-3m deltas to ignore Google's ±5m sample noise on flat ground.
const NOISE_THRESHOLD_M = 3;

// Elevation API path= length is bounded by URL size; 256 samples fits well
// inside Google's 8KB query limit using the lat,lng|... form (no encoder).
const MAX_SAMPLES = 256;

interface ElevationResponse {
  status: string;
  results?: { elevation: number }[];
  error_message?: string;
}

/**
 * Fetch cumulative elevation gain/loss (in metres, integer-rounded) along the
 * given path. Returns null on any failure (no API key, network error, fewer
 * than 2 points, non-OK Google status).
 */
export async function fetchElevationStats(
  path: LatLng[]
): Promise<{ gainM: number; lossM: number } | null> {
  const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  if (!apiKey) return null;
  if (path.length < 2) return null;

  const sampled = decimatePath(path, MAX_SAMPLES);
  const pathParam = sampled.map((p) => `${p.lat},${p.lng}`).join("|");
  const samples = Math.min(sampled.length, MAX_SAMPLES);
  const url = `${ELEVATION_ENDPOINT}?path=${encodeURIComponent(
    pathParam
  )}&samples=${samples}&key=${apiKey}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const body = (await res.json()) as ElevationResponse;
    if (body.status !== "OK" || !body.results || body.results.length < 2) {
      return null;
    }

    let gain = 0;
    let loss = 0;
    for (let i = 1; i < body.results.length; i++) {
      const delta = body.results[i].elevation - body.results[i - 1].elevation;
      if (Math.abs(delta) < NOISE_THRESHOLD_M) continue;
      if (delta > 0) gain += delta;
      else loss += -delta;
    }
    return { gainM: Math.round(gain), lossM: Math.round(loss) };
  } catch {
    return null;
  }
}

/**
 * Per-sample elevation profile aligned with cumulative distance along the
 * path. Returns `[{ distKm, elev }, ...]` suitable for an SVG line chart.
 *
 * Same single-request budget as fetchElevationStats — at most 256 samples,
 * one API call. Caller is responsible for caching the result.
 */
export async function fetchElevationProfile(
  path: LatLng[]
): Promise<{ distKm: number; elev: number }[] | null> {
  const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  if (!apiKey) return null;
  if (path.length < 2) return null;

  const sampled = decimatePath(path, MAX_SAMPLES);
  const pathParam = sampled.map((p) => `${p.lat},${p.lng}`).join("|");
  const samples = Math.min(sampled.length, MAX_SAMPLES);
  const url = `${ELEVATION_ENDPOINT}?path=${encodeURIComponent(
    pathParam
  )}&samples=${samples}&key=${apiKey}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const body = (await res.json()) as ElevationResponse;
    if (body.status !== "OK" || !body.results || body.results.length < 2) {
      return null;
    }
    // Google returns N elevations spaced evenly along `path`. Compute the
    // cumulative distance to each sample using the original path geometry.
    const cumKm = cumulativeDistancesKm(sampled);
    const out: { distKm: number; elev: number }[] = [];
    for (let i = 0; i < body.results.length; i++) {
      const t = i / (body.results.length - 1);
      const d = t * cumKm[cumKm.length - 1];
      out.push({
        distKm: Math.round(d * 100) / 100,
        elev: Math.round(body.results[i].elevation),
      });
    }
    return out;
  } catch {
    return null;
  }
}

function cumulativeDistancesKm(path: LatLng[]): number[] {
  const out: number[] = [0];
  for (let i = 1; i < path.length; i++) {
    out.push(out[i - 1] + haversineKm(path[i - 1], path[i]));
  }
  return out;
}

function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
