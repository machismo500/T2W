import { haversineDistance, pathDistanceKm, type LatLng } from "@/lib/geo-utils";
import type { TrackPoint } from "@/types";

export interface PersonalRideStats {
  distanceKm: number;
  movingMinutes: number;
  elapsedMinutes: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  pointsCount: number;
}

// Speed below this is treated as "stopped" for moving-time calculation. Same
// floor used elsewhere in the codebase to filter GPS jitter at red lights.
const MOVING_SPEED_FLOOR_KMH = 1;

/**
 * Compute the requesting rider's personal ride totals from their own GPS
 * track. The lead rider's totals come from the existing metrics endpoint —
 * this is for the "Your ride" card which shows the user how *they* did, not
 * the convoy. Returns null when the path has fewer than 2 points.
 */
export function personalRideStats(path: TrackPoint[]): PersonalRideStats | null {
  if (!path || path.length < 2) return null;

  const distanceKm = pathDistanceKm(path as LatLng[]);

  let maxSpeed = 0;
  let movingSec = 0;
  let elapsedSec = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const tA = a.recordedAt ? Date.parse(a.recordedAt) : NaN;
    const tB = b.recordedAt ? Date.parse(b.recordedAt) : NaN;
    if (Number.isFinite(tA) && Number.isFinite(tB) && tB > tA) {
      const segSec = (tB - tA) / 1000;
      elapsedSec += segSec;
      // Use the segment's average speed (distance / time) so we don't depend on
      // the per-fix GPS speed reading, which can be missing on older Android.
      const segKm = haversineDistance(a as LatLng, b as LatLng) / 1000;
      const segSpeed = segSec > 0 ? (segKm / segSec) * 3600 : 0;
      if (segSpeed >= MOVING_SPEED_FLOOR_KMH) movingSec += segSec;
      if (segSpeed > maxSpeed) maxSpeed = segSpeed;
    }
    const reportedSpeed = b.speed;
    if (reportedSpeed != null && reportedSpeed > maxSpeed) {
      maxSpeed = reportedSpeed;
    }
  }

  const movingMinutes = movingSec / 60;
  const elapsedMinutes = elapsedSec / 60;
  const avgSpeedKmh = movingMinutes > 0 ? distanceKm / (movingMinutes / 60) : 0;

  return {
    distanceKm,
    movingMinutes,
    elapsedMinutes,
    avgSpeedKmh,
    maxSpeedKmh: maxSpeed,
    pointsCount: path.length,
  };
}
