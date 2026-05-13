/**
 * Pure timeline / camera script for the Relive flyover.
 *
 * Given a decimated track + breaks + headline metrics + target duration, this
 * module returns a `getStateAtTime(t)` function that the renderer (interactive
 * or headless) calls each frame to read camera params + HUD values.
 *
 * Pure on purpose: no Mapbox or DOM imports — keeps it unit-testable and
 * guarantees identical output for a given input across browser previews and
 * server renders, so the worker output matches what the user previewed.
 */
import { haversineDistance, type LatLng } from "@/lib/geo-utils";

export interface ReliveTrackPoint extends LatLng {
  /** Optional GPS-fix speed in km/h. Used for HUD + top-speed highlight. */
  speed?: number | null;
  /** Optional ISO timestamp. Used for HUD elapsed-time. */
  recordedAt?: string;
}

export interface ReliveBreak {
  startedAt: string;
  endedAt?: string;
  reason?: string | null;
}

export interface ReliveScriptInput {
  path: ReliveTrackPoint[];
  breaks?: ReliveBreak[];
  totalDistanceKm: number;
  totalElevationGainM?: number | null;
  /** Final clip length in seconds — clamped to [MIN, MAX]. */
  durationSec: number;
}

export type RelivePhase = "intro" | "flyover" | "outro";

export interface ReliveCameraState {
  lat: number;
  lng: number;
  bearing: number;
  pitch: number;
  zoom: number;
}

export interface ReliveHudState {
  kmCovered: number;
  elevGainedM: number;
  currentSpeedKmh: number | null;
  elapsedSec: number;
}

export interface ReliveHighlight {
  label: string;
  /** Normalised position [0,1] inside the flyover phase. */
  at: number;
  /** Path index this highlight points at. */
  pathIndex: number;
}

export interface ReliveFrameState {
  phase: RelivePhase;
  /** Progress through the current phase, 0-1. */
  phaseProgress: number;
  /** Progress through the entire flyover-phase, 0-1. Undefined during intro/outro. */
  flyoverProgress: number;
  camera: ReliveCameraState;
  hud: ReliveHudState;
  /** Highlight currently being shown, if any. */
  activeHighlight: ReliveHighlight | null;
}

export interface ReliveScript {
  durationSec: number;
  introSec: number;
  outroSec: number;
  /** Bounding box of the route — `[west, south, east, north]`. */
  bounds: [number, number, number, number];
  /** Decimated path used by the polyline + camera follow. */
  path: ReliveTrackPoint[];
  /** Cumulative distance in km at each path index. */
  cumKm: number[];
  highlights: ReliveHighlight[];
  getStateAtTime: (tSec: number) => ReliveFrameState;
}

const MIN_DURATION_SEC = 30;
const MAX_DURATION_SEC = 90;
const INTRO_SEC = 3;
const OUTRO_SEC = 3;
const HIGHLIGHT_WINDOW_SEC = 1.4;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function bearingDegrees(a: LatLng, b: LatLng): number {
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const deg = (Math.atan2(y, x) * 180) / Math.PI;
  return (deg + 360) % 360;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpBearing(a: number, b: number, t: number): number {
  let diff = ((b - a + 540) % 360) - 180;
  return (a + diff * t + 360) % 360;
}

function computeBounds(
  path: ReliveTrackPoint[]
): [number, number, number, number] {
  let west = path[0].lng;
  let east = path[0].lng;
  let south = path[0].lat;
  let north = path[0].lat;
  for (const p of path) {
    if (p.lng < west) west = p.lng;
    if (p.lng > east) east = p.lng;
    if (p.lat < south) south = p.lat;
    if (p.lat > north) north = p.lat;
  }
  return [west, south, east, north];
}

function findPathIndexByTimestamp(
  path: ReliveTrackPoint[],
  whenIso: string
): number {
  const target = Date.parse(whenIso);
  if (!Number.isFinite(target)) return 0;
  let bestIdx = 0;
  let bestDelta = Infinity;
  for (let i = 0; i < path.length; i++) {
    const ts = path[i].recordedAt ? Date.parse(path[i].recordedAt!) : NaN;
    if (!Number.isFinite(ts)) continue;
    const d = Math.abs(ts - target);
    if (d < bestDelta) {
      bestDelta = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/**
 * Build a complete script for the renderer. Throws if the path has fewer
 * than 2 usable points — call sites should fall back to a static frame.
 */
export function buildReliveScript(input: ReliveScriptInput): ReliveScript {
  const path = input.path.filter(
    (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)
  );
  if (path.length < 2) {
    throw new Error("Relive script needs at least 2 valid path points");
  }

  const durationSec = clamp(
    Math.round(input.durationSec || 60),
    MIN_DURATION_SEC,
    MAX_DURATION_SEC
  );
  const introSec = INTRO_SEC;
  const outroSec = OUTRO_SEC;
  const flyoverSec = Math.max(durationSec - introSec - outroSec, 10);

  const cumKm: number[] = [0];
  for (let i = 1; i < path.length; i++) {
    cumKm.push(cumKm[i - 1] + haversineDistance(path[i - 1], path[i]) / 1000);
  }
  const totalKm = Math.max(cumKm[cumKm.length - 1], 0.001);
  const totalElev = Math.max(input.totalElevationGainM ?? 0, 0);

  // First/last timestamp for HUD elapsed-time. Falls back to even spacing
  // when timestamps are missing (e.g. backfilled or smoothed paths).
  const firstTs = path.find((p) => p.recordedAt)?.recordedAt;
  const lastTs = [...path].reverse().find((p) => p.recordedAt)?.recordedAt;
  const totalElapsedSec =
    firstTs && lastTs
      ? Math.max((Date.parse(lastTs) - Date.parse(firstTs)) / 1000, 0)
      : 0;

  // Highlights: top-speed point + each break (capped at 3 to keep the clip
  // breezy). Position each highlight by its cumulative-km share so the
  // camera pause coincides with where it happened on the route.
  const highlights: ReliveHighlight[] = [];
  let topSpeedIdx = -1;
  let topSpeed = 0;
  for (let i = 0; i < path.length; i++) {
    const s = path[i].speed ?? 0;
    if (s != null && s > topSpeed) {
      topSpeed = s;
      topSpeedIdx = i;
    }
  }
  if (topSpeedIdx > 0 && topSpeed > 1) {
    highlights.push({
      label: `Top speed · ${Math.round(topSpeed)} km/h`,
      at: cumKm[topSpeedIdx] / totalKm,
      pathIndex: topSpeedIdx,
    });
  }
  for (const br of (input.breaks || []).slice(0, 3)) {
    const idx = findPathIndexByTimestamp(path, br.startedAt);
    if (idx > 0 && idx < path.length - 1) {
      highlights.push({
        label: br.reason ? `Break · ${br.reason}` : "Break",
        at: cumKm[idx] / totalKm,
        pathIndex: idx,
      });
    }
  }
  highlights.sort((a, b) => a.at - b.at);

  const bounds = computeBounds(path);

  // Coarse zoom estimate from bounds span — Mapbox's `fitBounds` will refine
  // this once the map mounts, but we need a reasonable default for headless
  // mode and the intro globe-zoom keyframe.
  const lngSpan = Math.max(Math.abs(bounds[2] - bounds[0]), 0.001);
  const latSpan = Math.max(Math.abs(bounds[3] - bounds[1]), 0.001);
  const span = Math.max(lngSpan, latSpan);
  const overviewZoom = clamp(Math.log2(360 / span) - 1, 4, 13);
  const followZoom = clamp(overviewZoom + 2.5, 11, 16);

  function findPathIndexAtFraction(frac: number): {
    index: number;
    segT: number;
  } {
    const targetKm = clamp(frac, 0, 1) * totalKm;
    // cumKm is sorted ascending — linear scan is fine for ~600 points.
    for (let i = 1; i < cumKm.length; i++) {
      if (cumKm[i] >= targetKm) {
        const segKm = cumKm[i] - cumKm[i - 1];
        const segT = segKm > 0 ? (targetKm - cumKm[i - 1]) / segKm : 0;
        return { index: i - 1, segT };
      }
    }
    return { index: cumKm.length - 2, segT: 1 };
  }

  function getStateAtTime(tSecRaw: number): ReliveFrameState {
    const tSec = clamp(tSecRaw, 0, durationSec);

    // Intro: globe-zoom from overviewZoom down to followZoom over `introSec`,
    // camera centred on the route mid-bbox, pitch eases from 0 → 45.
    if (tSec < introSec) {
      const p = tSec / introSec;
      const eased = easeInOut(p);
      return {
        phase: "intro",
        phaseProgress: p,
        flyoverProgress: 0,
        camera: {
          lat: (bounds[1] + bounds[3]) / 2,
          lng: (bounds[0] + bounds[2]) / 2,
          bearing: 0,
          pitch: lerp(0, 45, eased),
          zoom: lerp(overviewZoom - 1.5, overviewZoom, eased),
        },
        hud: {
          kmCovered: 0,
          elevGainedM: 0,
          currentSpeedKmh: null,
          elapsedSec: 0,
        },
        activeHighlight: null,
      };
    }

    // Outro: lift to overviewZoom, drop pitch, show full route.
    if (tSec >= durationSec - outroSec) {
      const p = (tSec - (durationSec - outroSec)) / outroSec;
      const eased = easeInOut(p);
      return {
        phase: "outro",
        phaseProgress: p,
        flyoverProgress: 1,
        camera: {
          lat: (bounds[1] + bounds[3]) / 2,
          lng: (bounds[0] + bounds[2]) / 2,
          bearing: 0,
          pitch: lerp(50, 25, eased),
          zoom: lerp(followZoom - 1, overviewZoom, eased),
        },
        hud: {
          kmCovered: totalKm,
          elevGainedM: totalElev,
          currentSpeedKmh: null,
          elapsedSec: totalElapsedSec,
        },
        activeHighlight: null,
      };
    }

    // Flyover phase. Map elapsed → fraction of path, but pause briefly inside
    // each highlight window so the camera lingers on the labelled moment.
    const flyT = tSec - introSec;
    let frac = flyT / flyoverSec;

    // Convert highlight `at` (path-fraction) values into time-fractions, then
    // pause-stretch around them. We do this iteratively per-highlight so the
    // total pause time stays bounded (HIGHLIGHT_WINDOW_SEC × N).
    let activeHighlight: ReliveHighlight | null = null;
    const totalPauseSec = highlights.length * HIGHLIGHT_WINDOW_SEC;
    if (highlights.length && totalPauseSec < flyoverSec) {
      const movingSec = flyoverSec - totalPauseSec;
      let consumed = 0;
      let resolved = false;
      for (const h of highlights) {
        const moveBudget = movingSec * h.at - consumed;
        if (flyT < moveBudget) {
          frac = (consumed + flyT) / movingSec;
          // Cap fraction at this highlight's path-position.
          frac = clamp(frac, 0, h.at);
          resolved = true;
          break;
        }
        if (flyT < moveBudget + HIGHLIGHT_WINDOW_SEC) {
          frac = h.at;
          activeHighlight = h;
          resolved = true;
          break;
        }
        consumed += moveBudget + HIGHLIGHT_WINDOW_SEC;
      }
      if (!resolved) {
        const tail = flyT - consumed;
        const remainingMoving = movingSec - movingSec * highlights[highlights.length - 1].at;
        const startFrac = highlights[highlights.length - 1].at;
        frac = remainingMoving > 0 ? startFrac + tail / movingSec : 1;
      }
    }
    frac = clamp(frac, 0, 1);

    const { index, segT } = findPathIndexAtFraction(frac);
    const a = path[index];
    const b = path[Math.min(index + 1, path.length - 1)];
    const lat = lerp(a.lat, b.lat, segT);
    const lng = lerp(a.lng, b.lng, segT);
    const bearing = bearingDegrees(a, b);

    // Smooth the bearing across a few neighbouring segments so the camera
    // doesn't snap on noisy GPS — tangent of the local 5-segment window.
    const lookAhead = path[Math.min(index + 4, path.length - 1)];
    const lookBack = path[Math.max(index - 2, 0)];
    const smoothedBearing = lerpBearing(bearing, bearingDegrees(lookBack, lookAhead), 0.6);

    // Pitch eases higher when curvature is low (long straights look better
    // tilted), lower in tight turns to keep the rider in frame.
    const turn = Math.abs(((bearingDegrees(lookBack, a) - bearingDegrees(b, lookAhead) + 540) % 360) - 180);
    const pitch = lerp(65, 45, clamp(turn / 90, 0, 1));

    const kmCovered = totalKm * frac;
    const elevGainedM = totalElev * frac;
    const elapsedSec = totalElapsedSec * frac;
    const currentSpeed =
      a.speed != null && b.speed != null
        ? lerp(a.speed, b.speed, segT)
        : a.speed ?? b.speed ?? null;

    return {
      phase: "flyover",
      phaseProgress: flyT / flyoverSec,
      flyoverProgress: frac,
      camera: {
        lat,
        lng,
        bearing: smoothedBearing,
        pitch,
        zoom: followZoom,
      },
      hud: {
        kmCovered,
        elevGainedM,
        currentSpeedKmh: currentSpeed,
        elapsedSec,
      },
      activeHighlight,
    };
  }

  return {
    durationSec,
    introSec,
    outroSec,
    bounds,
    path,
    cumKm,
    highlights,
    getStateAtTime,
  };
}
