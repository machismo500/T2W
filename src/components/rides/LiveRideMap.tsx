"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { LiveRiderLocation, TrackPoint } from "@/types";

// Colour ramps for the speed-tinted rendering mode. Calibrated for typical
// motorcycle ride conditions: stationary → dark blue, cruising → green,
// fast → red. Anything > 100 km/h saturates at red.
const SPEED_STOPS: { kmh: number; color: string }[] = [
  { kmh: 0, color: "#1e3a8a" },   // stopped — dark blue
  { kmh: 15, color: "#0ea5e9" },  // slow — sky
  { kmh: 40, color: "#22c55e" },  // cruising — green
  { kmh: 70, color: "#f59e0b" },  // brisk — amber
  { kmh: 100, color: "#ef4444" }, // fast — red
];

function speedToColor(kmh: number | null | undefined): string {
  if (kmh == null || !Number.isFinite(kmh)) return "#94a3b8"; // unknown — slate
  const s = Math.max(0, kmh);
  for (let i = 1; i < SPEED_STOPS.length; i++) {
    if (s <= SPEED_STOPS[i].kmh) {
      const a = SPEED_STOPS[i - 1];
      const b = SPEED_STOPS[i];
      const t = (s - a.kmh) / (b.kmh - a.kmh);
      return mixHex(a.color, b.color, t);
    }
  }
  return SPEED_STOPS[SPEED_STOPS.length - 1].color;
}

function mixHex(a: string, b: string, t: number): string {
  const ar = parseInt(a.slice(1, 3), 16);
  const ag = parseInt(a.slice(3, 5), 16);
  const ab = parseInt(a.slice(5, 7), 16);
  const br = parseInt(b.slice(1, 3), 16);
  const bg = parseInt(b.slice(3, 5), 16);
  const bb = parseInt(b.slice(5, 7), 16);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${bl.toString(16).padStart(2, "0")}`;
}

export type TrackStyleMode = "default" | "speed" | "accuracy";

interface LiveRideMapProps {
  plannedRoute?: { lat: number; lng: number }[];
  leadPath: TrackPoint[];
  myPath?: TrackPoint[];
  /** Which path to paint as the active polyline. Defaults to "lead". */
  pathView?: "lead" | "mine";
  riders: LiveRiderLocation[];
  startLocation?: { lat: number; lng: number };
  endLocation?: { lat: number; lng: number };
  isEnded?: boolean;
  /** Hide the on-map style toggle. Useful when the parent already provides one. */
  showStyleToggle?: boolean;
  /** When present, an amber marker is drawn at this position — used by the replay scrubber. */
  scrubberPosition?: { lat: number; lng: number; label?: string } | null;
}

// Color scheme for rider markers + polylines
const MARKER_COLORS = {
  lead: "#22c55e",    // green
  sweep: "#ef4444",   // red
  normal: "#3b82f6",  // blue
  deviated: "#f97316", // orange
};

const PATH_COLORS = {
  lead: MARKER_COLORS.lead, // green = the route everyone follows
  mine: MARKER_COLORS.normal, // blue = your personal trail
};

export function LiveRideMap({
  plannedRoute,
  leadPath,
  myPath = [],
  pathView = "lead",
  riders,
  startLocation,
  endLocation,
  isEnded,
  showStyleToggle = true,
  scrubberPosition = null,
}: LiveRideMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const plannedPolyRef = useRef<google.maps.Polyline | null>(null);
  // The active track is rendered as multiple sub-polylines so we can colour
  // / style each segment independently (dashed for interpolated, tinted by
  // speed, dimmed for low-accuracy fixes, etc.). We hold all of them in a
  // single ref and clear them on every re-render.
  const segmentPolysRef = useRef<google.maps.Polyline[]>([]);
  // Marker placed at the boundary of each multi-day pause. Drawn alongside
  // the segments so the user sees "Day 2 →" labels on long stops.
  const dayMarkersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const [styleMode, setStyleMode] = useState<TrackStyleMode>("default");
  const scrubberMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const markersRef = useRef<Map<string, google.maps.marker.AdvancedMarkerElement>>(new Map());
  const startMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const endMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);

  // Initialize map — runs once on mount. google.maps is already available because
  // LiveRidePage only renders this component after the Maps script onload fires.
  useEffect(() => {
    if (!mapRef.current || googleMapRef.current || !window.google?.maps) return;

    const center = startLocation ||
      plannedRoute?.[0] ||
      (riders[0] ? { lat: riders[0].lat, lng: riders[0].lng } : { lat: 12.97, lng: 77.59 });

    try {
      googleMapRef.current = new google.maps.Map(mapRef.current, {
        center,
        zoom: 12,
        mapId: "live-ride-map",
        gestureHandling: "greedy",
        streetViewControl: false,
        mapTypeControl: true,
        mapTypeControlOptions: {
          position: google.maps.ControlPosition.TOP_RIGHT,
        },
      });
    } catch (err) {
      console.error("[LiveRideMap] Map init failed:", err);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — run once; startLocation/riders used only for initial center

  // Draw planned route (grey dashed)
  useEffect(() => {
    if (!googleMapRef.current || !plannedRoute?.length) return;

    if (plannedPolyRef.current) {
      plannedPolyRef.current.setPath(plannedRoute);
    } else {
      plannedPolyRef.current = new google.maps.Polyline({
        path: plannedRoute,
        geodesic: true,
        strokeColor: "#9ca3af",
        strokeOpacity: 0.6,
        strokeWeight: 3,
        icons: [
          {
            icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 3 },
            offset: "0",
            repeat: "15px",
          },
        ],
        map: googleMapRef.current,
      });
    }
  }, [plannedRoute]);

  // Draw the active recorded path as a series of styled sub-polylines.
  //
  // The path is split between any two consecutive points where the visual
  // style would differ — gap-filled vs raw, low-accuracy vs good, overnight
  // pause vs normal sampling, or a different speed bucket. Each run is
  // rendered as one google.maps.Polyline so the map cheaply expresses:
  //   - dashed lines across Directions-API-filled stretches (#1)
  //   - speed-tinted colours along the route (#2)
  //   - dotted grey "Day N →" bridges over multi-day pauses (#3)
  //   - dimmed sections wherever GPS accuracy was bad (#6)
  const activePath = pathView === "mine" ? myPath : leadPath;
  const activeBaseColor = pathView === "mine" ? PATH_COLORS.mine : PATH_COLORS.lead;
  useEffect(() => {
    if (!googleMapRef.current) return;

    // Tear down everything from the previous render. Polyline geometry is
    // cheap; re-creating on every change keeps the segmenting code simple
    // and avoids stale-segment artefacts.
    for (const p of segmentPolysRef.current) p.setMap(null);
    segmentPolysRef.current = [];
    for (const m of dayMarkersRef.current) m.map = null;
    dayMarkersRef.current = [];

    if (activePath.length === 0) return;

    const map = googleMapRef.current;
    const segments = buildSegments(activePath, styleMode, activeBaseColor);
    for (const seg of segments) {
      if (seg.points.length < 2) continue;
      const poly = new google.maps.Polyline({
        path: seg.points,
        geodesic: true,
        strokeColor: seg.color,
        strokeOpacity: seg.dashed ? 0 : seg.opacity,
        strokeWeight: seg.weight,
        map,
        icons: seg.dashed
          ? [
              {
                icon: {
                  path: "M 0,-1 0,1",
                  strokeOpacity: seg.opacity,
                  strokeWeight: seg.weight,
                  scale: 3,
                },
                offset: "0",
                repeat: "12px",
              },
            ]
          : undefined,
      });
      segmentPolysRef.current.push(poly);
    }

    // Day-boundary labels live alongside the segments so they always
    // re-render together when the path changes.
    if (window.google?.maps?.marker) {
      for (const b of dayBoundaries(activePath)) {
        const el = document.createElement("div");
        el.textContent = `Day ${b.dayNumber} →`;
        el.style.cssText =
          "background:#1f2937;color:#fbbf24;padding:2px 6px;border-radius:6px;font-size:11px;font-weight:600;border:1px solid #fbbf24aa;box-shadow:0 1px 3px rgba(0,0,0,0.4)";
        const m = new google.maps.marker.AdvancedMarkerElement({
          map,
          position: { lat: b.point.lat, lng: b.point.lng },
          content: el,
          title: `Resumed after ${b.gapHours.toFixed(1)}h pause`,
        });
        dayMarkersRef.current.push(m);
      }
    }
  }, [activePath, activeBaseColor, styleMode]);

  // Scrubber marker — amber dot that follows the replay cursor.
  useEffect(() => {
    if (!googleMapRef.current || !window.google?.maps?.marker) return;
    if (!scrubberPosition) {
      if (scrubberMarkerRef.current) {
        scrubberMarkerRef.current.map = null;
        scrubberMarkerRef.current = null;
      }
      return;
    }
    if (!scrubberMarkerRef.current) {
      const el = document.createElement("div");
      el.style.cssText =
        "background:#fbbf24;border:2px solid #1f2937;border-radius:9999px;width:18px;height:18px;box-shadow:0 0 0 4px rgba(251,191,36,0.25)";
      scrubberMarkerRef.current = new google.maps.marker.AdvancedMarkerElement({
        map: googleMapRef.current,
        position: scrubberPosition,
        content: el,
        title: scrubberPosition.label,
      });
    } else {
      scrubberMarkerRef.current.position = scrubberPosition;
      scrubberMarkerRef.current.title = scrubberPosition.label ?? "";
    }
  }, [scrubberPosition]);

  // Create marker element
  const createMarkerContent = useCallback(
    (rider: LiveRiderLocation) => {
      const color = rider.isLead
        ? MARKER_COLORS.lead
        : rider.isSweep
          ? MARKER_COLORS.sweep
          : rider.isDeviated
            ? MARKER_COLORS.deviated
            : MARKER_COLORS.normal;

      const label = rider.isLead
        ? "Lead"
        : rider.isSweep
          ? "Sweep"
          : rider.userName.split(" ")[0];

      const el = document.createElement("div");
      el.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;transform:translateY(-50%);">
          <div style="background:${color};color:white;font-size:11px;font-weight:600;padding:2px 6px;border-radius:4px;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.3);${rider.isDeviated ? "animation:pulse 1.5s infinite" : ""}">
            ${label}${rider.speed ? ` · ${Math.round(rider.speed)} km/h` : ""}
          </div>
          <div style="width:12px;height:12px;background:${color};border:2px solid white;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,0.3);margin-top:2px;"></div>
        </div>
      `;
      return el;
    },
    []
  );

  // Update rider markers
  useEffect(() => {
    if (!googleMapRef.current) return;

    const currentIds = new Set(riders.map((r) => r.userId));

    // Remove markers for riders no longer present
    for (const [id, marker] of markersRef.current) {
      if (!currentIds.has(id)) {
        marker.map = null;
        markersRef.current.delete(id);
      }
    }

    // Update/create markers
    for (const rider of riders) {
      const existing = markersRef.current.get(rider.userId);
      if (existing) {
        existing.position = { lat: rider.lat, lng: rider.lng };
        existing.content = createMarkerContent(rider);
      } else {
        const marker = new google.maps.marker.AdvancedMarkerElement({
          map: googleMapRef.current,
          position: { lat: rider.lat, lng: rider.lng },
          content: createMarkerContent(rider),
          title: rider.userName,
        });
        markersRef.current.set(rider.userId, marker);
      }
    }
  }, [riders, createMarkerContent]);

  // Start/End location markers
  useEffect(() => {
    if (!googleMapRef.current) return;

    if (startLocation && !startMarkerRef.current) {
      const el = document.createElement("div");
      el.innerHTML = `<div style="background:#16a34a;color:white;padding:4px 8px;border-radius:6px;font-weight:700;font-size:12px;box-shadow:0 2px 4px rgba(0,0,0,0.3);">🏁 START</div>`;
      startMarkerRef.current = new google.maps.marker.AdvancedMarkerElement({
        map: googleMapRef.current,
        position: startLocation,
        content: el,
      });
    }

    if (endLocation && !endMarkerRef.current) {
      const el = document.createElement("div");
      el.innerHTML = `<div style="background:#dc2626;color:white;padding:4px 8px;border-radius:6px;font-weight:700;font-size:12px;box-shadow:0 2px 4px rgba(0,0,0,0.3);">🏁 END</div>`;
      endMarkerRef.current = new google.maps.marker.AdvancedMarkerElement({
        map: googleMapRef.current,
        position: endLocation,
        content: el,
      });
    }
  }, [startLocation, endLocation]);

  // Fit bounds when map loads or riders change
  useEffect(() => {
    if (!googleMapRef.current) return;
    const bounds = new google.maps.LatLngBounds();
    let hasPoints = false;

    if (plannedRoute) {
      for (const p of plannedRoute) {
        bounds.extend(p);
        hasPoints = true;
      }
    }
    for (const r of riders) {
      bounds.extend({ lat: r.lat, lng: r.lng });
      hasPoints = true;
    }
    if (activePath.length > 0) {
      for (const p of activePath) {
        bounds.extend(p);
        hasPoints = true;
      }
    }

    if (hasPoints) {
      googleMapRef.current.fitBounds(bounds, 50);
    }
  }, [plannedRoute, riders, activePath]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full rounded-lg" />
      {isEnded && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-gray-900/80 text-white px-4 py-2 rounded-full text-sm font-medium backdrop-blur-sm">
          Ride Completed — Post-Ride View
        </div>
      )}
      {showStyleToggle && activePath.length > 0 && (
        <TrackStyleToggle mode={styleMode} setMode={setStyleMode} />
      )}
      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Track-style toggle (#1 #2 #6 legend) — small floating control on the map.
// ---------------------------------------------------------------------------
function TrackStyleToggle({
  mode,
  setMode,
}: {
  mode: TrackStyleMode;
  setMode: (m: TrackStyleMode) => void;
}) {
  return (
    <div className="absolute bottom-3 left-3 z-10 flex flex-col gap-1 rounded-lg bg-gray-900/85 p-2 text-xs text-white backdrop-blur-sm">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
        Track style
      </div>
      <div className="flex gap-1">
        {(
          [
            ["default", "Source"],
            ["speed", "Speed"],
            ["accuracy", "Quality"],
          ] as [TrackStyleMode, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setMode(key)}
            className={`rounded px-2 py-1 text-xs ${
              mode === key
                ? "bg-white text-gray-900"
                : "bg-white/10 text-white hover:bg-white/20"
            }`}
            data-testid={`style-${key}`}
          >
            {label}
          </button>
        ))}
      </div>
      <TrackStyleLegend mode={mode} />
    </div>
  );
}

function TrackStyleLegend({ mode }: { mode: TrackStyleMode }) {
  if (mode === "speed") {
    return (
      <div className="mt-1 flex items-center gap-1">
        <span className="text-[10px] text-gray-300">0</span>
        <div
          className="h-2 w-32 rounded"
          style={{
            background:
              "linear-gradient(to right,#1e3a8a 0%,#0ea5e9 15%,#22c55e 40%,#f59e0b 70%,#ef4444 100%)",
          }}
        />
        <span className="text-[10px] text-gray-300">100+ km/h</span>
      </div>
    );
  }
  if (mode === "accuracy") {
    return (
      <div className="mt-1 flex flex-col gap-0.5 text-[10px] text-gray-300">
        <div className="flex items-center gap-1">
          <span className="inline-block h-1 w-4 bg-white" /> good fix
        </div>
        <div className="flex items-center gap-1 opacity-50">
          <span className="inline-block h-1 w-4 bg-white" /> low accuracy (&gt;50 m)
        </div>
      </div>
    );
  }
  return (
    <div className="mt-1 flex flex-col gap-0.5 text-[10px] text-gray-300">
      <div className="flex items-center gap-1">
        <span className="inline-block h-1 w-4 bg-green-500" /> raw GPS
      </div>
      <div className="flex items-center gap-1">
        <span className="inline-block h-1 w-4 bg-green-500/60" /> snapped to road
      </div>
      <div className="flex items-center gap-1">
        <span
          className="inline-block h-1 w-4"
          style={{
            backgroundImage:
              "linear-gradient(to right,#f59e0b 0,#f59e0b 50%,transparent 50%,transparent 100%)",
            backgroundSize: "8px 1px",
            backgroundRepeat: "repeat-x",
          }}
        />{" "}
        gap-filled
      </div>
      <div className="flex items-center gap-1">
        <span
          className="inline-block h-1 w-4"
          style={{
            backgroundImage:
              "linear-gradient(to right,#94a3b8 0,#94a3b8 50%,transparent 50%,transparent 100%)",
            backgroundSize: "6px 1px",
            backgroundRepeat: "repeat-x",
          }}
        />{" "}
        overnight pause
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Path segmentation — split the recorded track into runs that share visual
// style. Each run becomes one Polyline.
// ---------------------------------------------------------------------------

interface Segment {
  points: { lat: number; lng: number }[];
  color: string;
  opacity: number;
  weight: number;
  /** True for gap-filled or overnight bridges. Renders as a dashed icon line. */
  dashed: boolean;
}

const ACCURACY_GOOD_M = 50;
const OVERNIGHT_GAP_MS = 3 * 60 * 60 * 1000; // 3h = "they slept"

function buildSegments(
  path: TrackPoint[],
  mode: TrackStyleMode,
  baseColor: string
): Segment[] {
  if (path.length < 2) return [];
  const out: Segment[] = [];
  let cur: Segment | null = null;

  // Style for the segment that *enters* point[i] (i.e. the line from i-1 → i).
  const styleFor = (a: TrackPoint, b: TrackPoint): Omit<Segment, "points"> => {
    const tA = a.recordedAt ? Date.parse(a.recordedAt) : NaN;
    const tB = b.recordedAt ? Date.parse(b.recordedAt) : NaN;
    const overnight =
      Number.isFinite(tA) && Number.isFinite(tB) && tB - tA > OVERNIGHT_GAP_MS;
    if (overnight) {
      return { color: "#94a3b8", opacity: 0.8, weight: 2, dashed: true };
    }
    if (b.isInterpolated || a.isInterpolated) {
      return { color: "#f59e0b", opacity: 0.9, weight: 4, dashed: true };
    }
    if (mode === "speed") {
      // Average the two endpoint speeds when both are known; otherwise fall
      // back to whichever side reported.
      const sp = avg(b.speed, a.speed);
      return { color: speedToColor(sp), opacity: 0.95, weight: 4, dashed: false };
    }
    if (mode === "accuracy") {
      const lowAcc =
        (b.accuracy != null && b.accuracy > ACCURACY_GOOD_M) ||
        (a.accuracy != null && a.accuracy > ACCURACY_GOOD_M);
      return {
        color: baseColor,
        opacity: lowAcc ? 0.3 : 0.95,
        weight: lowAcc ? 2 : 4,
        dashed: false,
      };
    }
    // Default "source" mode.
    if (b.isSnapped || a.isSnapped) {
      return { color: baseColor, opacity: 0.6, weight: 4, dashed: false };
    }
    return { color: baseColor, opacity: 0.95, weight: 4, dashed: false };
  };

  for (let i = 1; i < path.length; i++) {
    const s = styleFor(path[i - 1], path[i]);
    const sameRun =
      cur &&
      cur.color === s.color &&
      cur.opacity === s.opacity &&
      cur.weight === s.weight &&
      cur.dashed === s.dashed;
    if (!sameRun) {
      cur = { points: [path[i - 1]], ...s };
      out.push(cur);
    }
    cur!.points.push(path[i]);
  }
  return out;
}

function avg(a: number | null | undefined, b: number | null | undefined): number | null {
  const xs = [a, b].filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  if (xs.length === 0) return null;
  return xs.reduce((s, n) => s + n, 0) / xs.length;
}

// Each (gap > OVERNIGHT_GAP_MS) → one boundary marker placed at the next
// resume point. Used by the LiveRideMap effect to drop "Day N →" labels.
function dayBoundaries(
  path: TrackPoint[]
): { point: TrackPoint; dayNumber: number; gapHours: number }[] {
  const out: { point: TrackPoint; dayNumber: number; gapHours: number }[] = [];
  let dayNumber = 2;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1].recordedAt ? Date.parse(path[i - 1].recordedAt!) : NaN;
    const b = path[i].recordedAt ? Date.parse(path[i].recordedAt!) : NaN;
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    const gap = b - a;
    if (gap > OVERNIGHT_GAP_MS) {
      out.push({
        point: path[i],
        dayNumber,
        gapHours: gap / (60 * 60 * 1000),
      });
      dayNumber++;
    }
  }
  return out;
}
