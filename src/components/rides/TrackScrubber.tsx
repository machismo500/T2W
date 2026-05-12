"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, SkipBack, FastForward } from "lucide-react";
import type { TrackPoint } from "@/types";

interface TrackScrubberProps {
  path: TrackPoint[];
  /** Called whenever the scrubber position changes (drag, play, etc.). */
  onPosition?: (pos: { point: TrackPoint; index: number; cumulativeKm: number } | null) => void;
  className?: string;
}

const PLAYBACK_SPEEDS = [1, 5, 20, 100, 500] as const;

/**
 * Time-based replay control for a recorded track. Drag the slider or press
 * play to watch a marker animate along the path; the parent uses
 * `onPosition` to draw that marker on the map and to update a live stats
 * readout.
 *
 * Why this matters: a static polyline doesn't reveal pacing, breaks, or
 * the moment offline gaps were filled in. Scrubbing through time makes all
 * of that obvious — and surfaces bugs (e.g. a Smooth & fill that warped
 * across the wrong road) at a glance.
 */
export function TrackScrubber({ path, onPosition, className }: TrackScrubberProps) {
  const { hasTimes, totalMs, totalKm, cumDistKm } = useMemo(
    () => preprocess(path),
    [path]
  );
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(20);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);

  // Snap idx back into range whenever the underlying path changes.
  useEffect(() => {
    if (idx >= path.length) setIdx(Math.max(0, path.length - 1));
  }, [path.length, idx]);

  // Push the current sample up to the parent so it can draw a marker /
  // update its live readout.
  useEffect(() => {
    if (path.length === 0) {
      onPosition?.(null);
      return;
    }
    const point = path[Math.min(idx, path.length - 1)];
    const cumulativeKm = cumDistKm[Math.min(idx, cumDistKm.length - 1)] ?? 0;
    onPosition?.({ point, index: idx, cumulativeKm });
  }, [idx, path, cumDistKm, onPosition]);

  // requestAnimationFrame loop for play mode. Each tick advances idx based
  // on real elapsed wall-clock time multiplied by the playback speed.
  const stopAnim = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);
  useEffect(() => {
    if (!playing) {
      stopAnim();
      return;
    }
    if (path.length < 2) {
      setPlaying(false);
      return;
    }
    lastTickRef.current = performance.now();
    const tick = (now: number) => {
      const dtMs = now - lastTickRef.current;
      lastTickRef.current = now;
      setIdx((prev) => {
        if (prev >= path.length - 1) {
          setPlaying(false);
          return prev;
        }
        if (hasTimes) {
          const advanceMs = dtMs * speed;
          const targetT = Date.parse(path[prev].recordedAt!) + advanceMs;
          let next = prev + 1;
          while (
            next < path.length - 1 &&
            Date.parse(path[next].recordedAt!) < targetT
          ) {
            next++;
          }
          return next;
        }
        // No timestamps — fall back to a fixed step proportional to speed.
        const step = Math.max(1, Math.floor((speed * dtMs) / 50));
        return Math.min(path.length - 1, prev + step);
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return stopAnim;
  }, [playing, path, speed, hasTimes, stopAnim]);

  if (path.length < 2) return null;

  const cur = path[Math.min(idx, path.length - 1)];
  const curMs = cur.recordedAt ? Date.parse(cur.recordedAt) : NaN;
  const startMs = hasTimes ? Date.parse(path[0].recordedAt!) : 0;
  const elapsedMs = Number.isFinite(curMs) ? curMs - startMs : 0;

  return (
    <div
      className={`flex flex-col gap-2 rounded-lg border border-t2w-border bg-t2w-surface-light/30 p-3 text-xs text-white ${className ?? ""}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-t2w-muted">
          <span className="font-semibold text-white">Replay</span>
          <span>
            {hasTimes ? formatElapsed(elapsedMs) : `point ${idx + 1} / ${path.length}`}
          </span>
          <span>
            {cumDistKm[Math.min(idx, cumDistKm.length - 1)]?.toFixed(1) ?? "0.0"} / {totalKm.toFixed(1)} km
          </span>
          {cur.speed != null && (
            <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[11px]">
              {Math.round(cur.speed)} km/h
            </span>
          )}
          {cur.isInterpolated && (
            <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[11px] font-medium text-amber-300">
              gap-filled
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIdx(0)}
            className="rounded p-1 text-t2w-muted hover:bg-white/10 hover:text-white"
            title="Restart"
          >
            <SkipBack className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className="rounded bg-t2w-accent/15 px-2 py-1 text-t2w-accent hover:bg-t2w-accent/25"
            title={playing ? "Pause" : "Play"}
            data-testid="scrubber-play"
          >
            {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => {
              const cur = PLAYBACK_SPEEDS.indexOf(speed as (typeof PLAYBACK_SPEEDS)[number]);
              setSpeed(PLAYBACK_SPEEDS[(cur + 1) % PLAYBACK_SPEEDS.length]);
            }}
            className="flex items-center gap-1 rounded p-1 text-t2w-muted hover:bg-white/10 hover:text-white"
            title="Playback speed"
          >
            <FastForward className="h-3.5 w-3.5" />
            <span className="font-mono">{speed}×</span>
          </button>
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={Math.max(0, path.length - 1)}
        step={1}
        value={idx}
        onChange={(e) => {
          setIdx(parseInt(e.target.value, 10));
          if (playing) setPlaying(false);
        }}
        className="w-full accent-t2w-accent"
        data-testid="scrubber-slider"
      />
      {hasTimes && totalMs > 0 && (
        <div className="flex justify-between text-[10px] text-t2w-muted">
          <span>{formatClock(startMs)}</span>
          <span>{formatClock(startMs + totalMs)}</span>
        </div>
      )}
    </div>
  );
}

function preprocess(path: TrackPoint[]): {
  hasTimes: boolean;
  totalMs: number;
  totalKm: number;
  cumDistKm: number[];
} {
  if (path.length < 2) return { hasTimes: false, totalMs: 0, totalKm: 0, cumDistKm: [0] };
  const hasTimes = path.every((p) => !!p.recordedAt);
  const totalMs = hasTimes
    ? Date.parse(path[path.length - 1].recordedAt!) -
      Date.parse(path[0].recordedAt!)
    : 0;
  const cumDistKm = [0];
  for (let i = 1; i < path.length; i++) {
    cumDistKm.push(cumDistKm[i - 1] + haversineKm(path[i - 1], path[i]));
  }
  return { hasTimes, totalMs, totalKm: cumDistKm[cumDistKm.length - 1], cumDistKm };
}

function haversineKm(a: TrackPoint, b: TrackPoint): number {
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

function formatElapsed(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "0s";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function formatClock(ms: number): string {
  if (!Number.isFinite(ms)) return "";
  const d = new Date(ms);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
