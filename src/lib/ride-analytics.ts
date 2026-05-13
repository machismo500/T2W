// Pure functions that derive post-ride analytics from raw track / elevation
// data. Kept side-effect-free so the analytics API route can call them with
// data already fetched in parallel with everything else it needs, and unit
// tests can exercise them without a DB.

import { haversineDistance, type LatLng } from "./geo-utils";

export interface TimedPoint extends LatLng {
  recordedAt: Date;
  speed?: number | null;
}

export interface PaceSplit {
  index: number;
  distanceKm: number;
  durationSec: number;
  avgSpeedKmh: number;
  elevGainM: number | null;
  elevLossM: number | null;
}

export interface ElevationProfileSample {
  distKm: number;
  elev: number;
}

export interface ElevationSummary {
  minM: number;
  maxM: number;
  netM: number;
  gainM: number;
  lossM: number;
}

export interface ClimbStats {
  longest: { distanceKm: number; gainM: number; startKm: number; endKm: number } | null;
  steepest: { gradePct: number; gainM: number; startKm: number; endKm: number } | null;
}

export interface CohesionSnapshot {
  /** Largest distance between any pair of tracked riders at the same timestamp slice. */
  maxGapKm: number;
  /** Median gap, in km, across all slices. */
  medianGapKm: number;
  /** % of slices where every rider was within `togetherThresholdKm` of the lead. */
  togetherPct: number;
  /** Total deviation events recorded across all riders. */
  deviationEvents: number;
  /** Riders considered in the calculation. */
  riderCount: number;
  /** Threshold used for "together" classification (km). */
  togetherThresholdKm: number;
}

export interface LeaderboardEntry {
  userId: string;
  name: string;
  avatar?: string | null;
  distanceKm: number;
  movingMinutes: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  pointCount: number;
  deviationCount: number;
  isLead: boolean;
  isSweep: boolean;
}

// ─── Pace splits ─────────────────────────────────────────────────────────────

/**
 * Build per-km splits by walking a single rider's track. The last bucket can
 * be < 1 km long; we keep it so the totals reconcile with the headline
 * distance, and tag it with the partial distance.
 *
 * The elevation profile is optional — when present, we attribute gain/loss
 * to each split by interpolating along the profile's cumulative-distance
 * series. Both arrays must be ordered.
 */
export function computeSplits(
  points: TimedPoint[],
  profile: ElevationProfileSample[] | null,
  bucketKm = 1
): PaceSplit[] {
  if (points.length < 2 || bucketKm <= 0) return [];

  const splits: PaceSplit[] = [];
  let bucketStartIdx = 0;
  let bucketStartKm = 0;
  let cumKm = 0;

  // Build cumulative distance once so the elevation lookup below is O(log n)
  // per split (binary search), not O(n) per point.
  const cumPerPoint: number[] = new Array(points.length);
  cumPerPoint[0] = 0;
  for (let i = 1; i < points.length; i++) {
    cumPerPoint[i] =
      cumPerPoint[i - 1] + haversineDistance(points[i - 1], points[i]) / 1000;
  }
  const totalKm = cumPerPoint[cumPerPoint.length - 1];
  if (totalKm < 0.05) return [];

  function pushSplit(startIdx: number, endIdx: number, startKm: number, endKm: number) {
    if (endIdx <= startIdx) return;
    const distanceKm = endKm - startKm;
    if (distanceKm <= 0) return;
    const durationSec = Math.max(
      1,
      Math.round(
        (points[endIdx].recordedAt.getTime() -
          points[startIdx].recordedAt.getTime()) /
          1000
      )
    );
    const avgSpeedKmh = (distanceKm / durationSec) * 3600;
    const { gainM, lossM } = profile
      ? attributeElevation(profile, startKm, endKm)
      : { gainM: null, lossM: null };
    splits.push({
      index: splits.length + 1,
      distanceKm: Math.round(distanceKm * 100) / 100,
      durationSec,
      avgSpeedKmh: Math.round(avgSpeedKmh * 10) / 10,
      elevGainM: gainM,
      elevLossM: lossM,
    });
  }

  for (let i = 1; i < points.length; i++) {
    cumKm = cumPerPoint[i];
    while (cumKm - bucketStartKm >= bucketKm) {
      // Interpolate the exact crossing point for clean split boundaries.
      const targetKm = bucketStartKm + bucketKm;
      const prevKm = cumPerPoint[i - 1];
      const segKm = cumPerPoint[i] - prevKm;
      const t = segKm > 0 ? (targetKm - prevKm) / segKm : 0;
      // Use linear interpolation on timestamps to avoid a fake split being
      // dominated by a single long-gap segment.
      const segMs =
        points[i].recordedAt.getTime() - points[i - 1].recordedAt.getTime();
      const crossingMs = points[i - 1].recordedAt.getTime() + segMs * t;
      const synthetic: TimedPoint = {
        lat: points[i - 1].lat + (points[i].lat - points[i - 1].lat) * t,
        lng: points[i - 1].lng + (points[i].lng - points[i - 1].lng) * t,
        recordedAt: new Date(crossingMs),
      };
      const tmpEnd = points.length;
      points.splice(i, 0, synthetic);
      cumPerPoint.splice(i, 0, targetKm);
      pushSplit(bucketStartIdx, i, bucketStartKm, targetKm);
      bucketStartIdx = i;
      bucketStartKm = targetKm;
      // We mutated `points` in place; the outer loop's `i` cursor advances
      // past the synthetic boundary on the next iteration. Reset cum cursor.
      cumKm = cumPerPoint[i];
      // Guard so the splice can't run away if floating-point drift creates
      // a zero-length bucket.
      if (i >= tmpEnd + 50_000) break;
    }
  }
  // Trailing partial split — only if the remainder is at least 50 m so we
  // don't render a "0.0 km · 0:00" row from GPS noise.
  if (totalKm - bucketStartKm >= 0.05) {
    pushSplit(bucketStartIdx, points.length - 1, bucketStartKm, totalKm);
  }

  return splits;
}

function attributeElevation(
  profile: ElevationProfileSample[],
  startKm: number,
  endKm: number
): { gainM: number; lossM: number } {
  if (profile.length < 2) return { gainM: 0, lossM: 0 };
  const startElev = interpolateElev(profile, startKm);
  const endElev = interpolateElev(profile, endKm);
  let gain = 0;
  let loss = 0;
  // Walk the inclusive interior samples so the gain/loss accumulates around
  // peaks rather than just relying on the endpoints.
  let prev = startElev;
  for (const sample of profile) {
    if (sample.distKm <= startKm) continue;
    if (sample.distKm >= endKm) break;
    const delta = sample.elev - prev;
    if (delta > 0) gain += delta;
    else loss += -delta;
    prev = sample.elev;
  }
  const tailDelta = endElev - prev;
  if (tailDelta > 0) gain += tailDelta;
  else loss += -tailDelta;
  return { gainM: Math.round(gain), lossM: Math.round(loss) };
}

function interpolateElev(profile: ElevationProfileSample[], km: number): number {
  if (km <= profile[0].distKm) return profile[0].elev;
  if (km >= profile[profile.length - 1].distKm) {
    return profile[profile.length - 1].elev;
  }
  // Linear search is fine — ≤256 samples by design.
  for (let i = 1; i < profile.length; i++) {
    if (profile[i].distKm >= km) {
      const a = profile[i - 1];
      const b = profile[i];
      const span = b.distKm - a.distKm;
      const t = span > 0 ? (km - a.distKm) / span : 0;
      return a.elev + (b.elev - a.elev) * t;
    }
  }
  return profile[profile.length - 1].elev;
}

// ─── Elevation summary ───────────────────────────────────────────────────────

const ELEV_NOISE_M = 3;

export function summarizeElevation(
  profile: ElevationProfileSample[] | null
): ElevationSummary | null {
  if (!profile || profile.length < 2) return null;
  let min = Infinity;
  let max = -Infinity;
  let gain = 0;
  let loss = 0;
  for (let i = 0; i < profile.length; i++) {
    const e = profile[i].elev;
    if (e < min) min = e;
    if (e > max) max = e;
    if (i > 0) {
      const delta = e - profile[i - 1].elev;
      if (Math.abs(delta) < ELEV_NOISE_M) continue;
      if (delta > 0) gain += delta;
      else loss += -delta;
    }
  }
  return {
    minM: Math.round(min),
    maxM: Math.round(max),
    netM: Math.round(profile[profile.length - 1].elev - profile[0].elev),
    gainM: Math.round(gain),
    lossM: Math.round(loss),
  };
}

// ─── Climb analytics ─────────────────────────────────────────────────────────

/**
 * Find the longest continuous ascent and the steepest sustained gradient
 * over a sliding window. Both pulled from the same elevation profile.
 *
 *   - Longest climb: the longest run where each sample is monotonically
 *     non-decreasing (with sub-3m noise tolerated so a single 1m dip
 *     doesn't split a 5 km climb).
 *   - Steepest gradient: max gain / distance over a window of at least
 *     0.5 km. Anything shorter is dominated by GPS noise.
 */
export function computeClimbStats(
  profile: ElevationProfileSample[] | null
): ClimbStats {
  const empty: ClimbStats = { longest: null, steepest: null };
  if (!profile || profile.length < 3) return empty;

  // --- Longest climb (monotone-with-noise) ---
  let longest = empty.longest;
  let curStartKm = profile[0].distKm;
  let curStartElev = profile[0].elev;
  let curMaxElev = profile[0].elev;
  let curBackdrop = profile[0].elev; // baseline we compare against for noise

  function commit(endKm: number, endElev: number) {
    const dist = endKm - curStartKm;
    const gain = endElev - curStartElev;
    if (dist >= 0.3 && gain >= 30) {
      if (!longest || dist > longest.distanceKm) {
        longest = {
          distanceKm: Math.round(dist * 100) / 100,
          gainM: Math.round(gain),
          startKm: Math.round(curStartKm * 100) / 100,
          endKm: Math.round(endKm * 100) / 100,
        };
      }
    }
  }

  for (let i = 1; i < profile.length; i++) {
    const cur = profile[i];
    const delta = cur.elev - curBackdrop;
    if (delta >= -ELEV_NOISE_M) {
      // Still climbing or oscillating within noise.
      if (cur.elev > curMaxElev) {
        curMaxElev = cur.elev;
        curBackdrop = cur.elev;
      }
    } else {
      // Clear descent — commit the run that just ended and start a new one.
      commit(profile[i - 1].distKm, curMaxElev);
      curStartKm = cur.distKm;
      curStartElev = cur.elev;
      curMaxElev = cur.elev;
      curBackdrop = cur.elev;
    }
  }
  commit(profile[profile.length - 1].distKm, curMaxElev);

  // --- Steepest gradient over ≥0.5 km window ---
  const MIN_WINDOW_KM = 0.5;
  let steepest = empty.steepest;
  let left = 0;
  for (let right = 1; right < profile.length; right++) {
    while (
      left < right - 1 &&
      profile[right].distKm - profile[left + 1].distKm >= MIN_WINDOW_KM
    ) {
      left++;
    }
    const dist = profile[right].distKm - profile[left].distKm;
    if (dist < MIN_WINDOW_KM) continue;
    const gain = profile[right].elev - profile[left].elev;
    if (gain <= 0) continue;
    const gradePct = (gain / (dist * 1000)) * 100;
    if (!steepest || gradePct > steepest.gradePct) {
      steepest = {
        gradePct: Math.round(gradePct * 10) / 10,
        gainM: Math.round(gain),
        startKm: Math.round(profile[left].distKm * 100) / 100,
        endKm: Math.round(profile[right].distKm * 100) / 100,
      };
    }
  }

  return { longest, steepest };
}

// ─── Group cohesion ──────────────────────────────────────────────────────────

export interface CohesionInputRider {
  userId: string;
  points: TimedPoint[];
}

/**
 * Snapshot the convoy every `sliceSec` seconds across the session window and
 * measure the spread between riders. We anchor on the lead rider's position
 * — anyone without a fix in the slice is dropped from that slice.
 *
 * Riders < `togetherThresholdKm` from the lead at a slice = "together".
 * Slices where every tracked rider is together count toward `togetherPct`.
 */
export function computeCohesion(
  leadRiderId: string | null,
  riders: CohesionInputRider[],
  windowStart: Date,
  windowEnd: Date,
  deviationCounts: Map<string, number>,
  sliceSec = 30,
  togetherThresholdKm = 0.75
): CohesionSnapshot | null {
  if (!leadRiderId) return null;
  if (riders.length < 2) return null;
  const lead = riders.find((r) => r.userId === leadRiderId);
  if (!lead || lead.points.length === 0) return null;

  const startMs = windowStart.getTime();
  const endMs = windowEnd.getTime();
  if (endMs <= startMs) return null;
  const sliceMs = sliceSec * 1000;
  const sliceCount = Math.min(720, Math.floor((endMs - startMs) / sliceMs));
  if (sliceCount < 2) return null;

  // Sort each rider's points by time once so the binary search below is sane.
  const sortedByRider = new Map<string, TimedPoint[]>();
  for (const r of riders) {
    sortedByRider.set(
      r.userId,
      [...r.points].sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime())
    );
  }

  let totalDeviations = 0;
  for (const [, n] of deviationCounts) totalDeviations += n;

  const allGaps: number[] = [];
  let togetherSlices = 0;
  let inhabitedSlices = 0;
  let maxGapKm = 0;

  for (let s = 0; s < sliceCount; s++) {
    const sliceMid = new Date(startMs + s * sliceMs + sliceMs / 2);
    const leadPos = positionAt(sortedByRider.get(leadRiderId)!, sliceMid);
    if (!leadPos) continue;

    let sliceMaxGap = 0;
    let allTogether = true;
    let othersSeen = 0;
    for (const r of riders) {
      if (r.userId === leadRiderId) continue;
      const pos = positionAt(sortedByRider.get(r.userId)!, sliceMid);
      if (!pos) continue;
      othersSeen++;
      const gapKm = haversineDistance(leadPos, pos) / 1000;
      if (gapKm > sliceMaxGap) sliceMaxGap = gapKm;
      if (gapKm > togetherThresholdKm) allTogether = false;
    }
    if (othersSeen === 0) continue;
    inhabitedSlices++;
    allGaps.push(sliceMaxGap);
    if (sliceMaxGap > maxGapKm) maxGapKm = sliceMaxGap;
    if (allTogether) togetherSlices++;
  }

  if (inhabitedSlices === 0) return null;

  allGaps.sort((a, b) => a - b);
  const medianGapKm = allGaps[Math.floor(allGaps.length / 2)];

  return {
    maxGapKm: Math.round(maxGapKm * 100) / 100,
    medianGapKm: Math.round(medianGapKm * 100) / 100,
    togetherPct: Math.round((togetherSlices / inhabitedSlices) * 100),
    deviationEvents: totalDeviations,
    riderCount: riders.length,
    togetherThresholdKm,
  };
}

function positionAt(points: TimedPoint[], when: Date): LatLng | null {
  if (points.length === 0) return null;
  const ms = when.getTime();
  // Reject slices outside the rider's recording window so a 1-h-late rider
  // doesn't get a synthetic "stationary at the start" reading.
  if (
    ms < points[0].recordedAt.getTime() - 60_000 ||
    ms > points[points.length - 1].recordedAt.getTime() + 60_000
  ) {
    return null;
  }
  // Binary search the first point at-or-after `when`.
  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (points[mid].recordedAt.getTime() < ms) lo = mid + 1;
    else hi = mid;
  }
  if (lo === 0) return { lat: points[0].lat, lng: points[0].lng };
  const a = points[lo - 1];
  const b = points[lo];
  const span = b.recordedAt.getTime() - a.recordedAt.getTime();
  if (span <= 0) return { lat: a.lat, lng: a.lng };
  const t = Math.max(0, Math.min(1, (ms - a.recordedAt.getTime()) / span));
  return {
    lat: a.lat + (b.lat - a.lat) * t,
    lng: a.lng + (b.lng - a.lng) * t,
  };
}
