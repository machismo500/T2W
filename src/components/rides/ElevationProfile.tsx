"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api-client";

interface ElevationProfileProps {
  rideId: string;
  userId: string | undefined;
  /** Notified when the user hovers a distance — parent can draw a crosshair on the map. */
  onHoverDistance?: (distKm: number | null) => void;
  className?: string;
}

interface Sample {
  distKm: number;
  elev: number;
}

/**
 * 60-pixel SVG strip showing elevation (y) against cumulative distance (x).
 * No charting library — saves ~80 KB of bundle and the use case is simple
 * enough to plot directly. Hover scrubs a vertical crosshair and forwards
 * the distance to the parent so the map can place a sync'd marker.
 */
export function ElevationProfile({
  rideId,
  userId,
  onHoverDistance,
  className,
}: ElevationProfileProps) {
  const [profile, setProfile] = useState<Sample[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setError(null);
    api.liveElevation
      .profile(rideId, userId)
      .then((data) => {
        if (cancelled) return;
        setProfile(data.profile);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Profile fetch failed");
      });
    return () => {
      cancelled = true;
    };
  }, [rideId, userId]);

  const layout = useMemo(() => layoutProfile(profile), [profile]);

  if (!userId) return null;
  if (error) {
    return (
      <div className={`rounded-lg border border-amber-400/30 bg-amber-400/5 p-3 text-xs text-amber-300 ${className ?? ""}`}>
        Elevation profile: {error}
      </div>
    );
  }
  if (!profile) {
    return (
      <div className={`h-[88px] rounded-lg border border-t2w-border bg-t2w-surface-light/30 p-3 text-xs text-t2w-muted ${className ?? ""}`}>
        Loading elevation profile…
      </div>
    );
  }
  if (profile.length < 2) {
    return (
      <div className={`h-[88px] rounded-lg border border-t2w-border bg-t2w-surface-light/30 p-3 text-xs text-t2w-muted ${className ?? ""}`}>
        Not enough recorded points to compute elevation.
      </div>
    );
  }

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = x / rect.width;
    const total = profile[profile.length - 1].distKm;
    setHoverX(x);
    onHoverDistance?.(Math.max(0, Math.min(total, ratio * total)));
  };
  const handleLeave = () => {
    setHoverX(null);
    onHoverDistance?.(null);
  };

  // Marker for the currently hovered sample.
  const hoverSample =
    hoverX != null && svgRef.current
      ? sampleAtX(profile, hoverX, svgRef.current.clientWidth)
      : null;

  return (
    <div
      className={`relative rounded-lg border border-t2w-border bg-t2w-surface-light/30 p-2 ${className ?? ""}`}
    >
      <div className="flex items-center justify-between px-1 pb-1 text-[10px] uppercase tracking-wide text-t2w-muted">
        <span>Elevation profile</span>
        <span>
          {Math.round(layout.minElev)}–{Math.round(layout.maxElev)} m · {profile[profile.length - 1].distKm.toFixed(1)} km
        </span>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 100 ${layout.viewH}`}
        preserveAspectRatio="none"
        className="block h-[60px] w-full cursor-crosshair"
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
      >
        {/* Filled area for the elevation curve */}
        <path d={layout.area} fill="#22c55e22" />
        <path d={layout.line} fill="none" stroke="#22c55e" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        {hoverX != null && svgRef.current && (
          <line
            x1={(hoverX / svgRef.current.clientWidth) * 100}
            x2={(hoverX / svgRef.current.clientWidth) * 100}
            y1={0}
            y2={layout.viewH}
            stroke="#fbbf24"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
      {hoverSample && (
        <div className="pointer-events-none absolute bottom-1 right-2 rounded bg-gray-900/80 px-2 py-0.5 text-[11px] text-amber-200">
          {hoverSample.distKm.toFixed(1)} km · {hoverSample.elev} m
        </div>
      )}
    </div>
  );
}

interface ProfileLayout {
  line: string;
  area: string;
  minElev: number;
  maxElev: number;
  viewH: number;
}

function layoutProfile(profile: Sample[] | null): ProfileLayout {
  if (!profile || profile.length < 2) {
    return { line: "", area: "", minElev: 0, maxElev: 0, viewH: 30 };
  }
  const viewH = 30;
  let min = Infinity;
  let max = -Infinity;
  for (const p of profile) {
    if (p.elev < min) min = p.elev;
    if (p.elev > max) max = p.elev;
  }
  const range = Math.max(1, max - min);
  const totalKm = profile[profile.length - 1].distKm;
  const toX = (km: number) => (totalKm > 0 ? (km / totalKm) * 100 : 0);
  // Margin from top/bottom so the line never touches the edges.
  const top = 2;
  const bottom = viewH - 2;
  const toY = (e: number) => bottom - ((e - min) / range) * (bottom - top);
  let line = "";
  for (let i = 0; i < profile.length; i++) {
    const cmd = i === 0 ? "M" : "L";
    line += `${cmd}${toX(profile[i].distKm).toFixed(2)},${toY(profile[i].elev).toFixed(2)} `;
  }
  const area = line + `L100,${viewH} L0,${viewH} Z`;
  return { line: line.trim(), area, minElev: min, maxElev: max, viewH };
}

function sampleAtX(profile: Sample[], hoverX: number, widthPx: number): Sample | null {
  if (profile.length === 0 || widthPx <= 0) return null;
  const total = profile[profile.length - 1].distKm;
  const ratio = Math.max(0, Math.min(1, hoverX / widthPx));
  const target = ratio * total;
  // Linear search is fine — at most 256 samples per profile.
  let nearest = profile[0];
  let nearestDelta = Math.abs(profile[0].distKm - target);
  for (const p of profile) {
    const d = Math.abs(p.distKm - target);
    if (d < nearestDelta) {
      nearestDelta = d;
      nearest = p;
    }
  }
  return nearest;
}
