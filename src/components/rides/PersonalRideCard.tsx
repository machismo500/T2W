"use client";

import { useMemo } from "react";
import { Bike, Clock, Gauge, Route, TrendingUp } from "lucide-react";
import type { LiveRideMetrics, TrackPoint } from "@/types";
import { personalRideStats } from "@/lib/personal-stats";

interface Props {
  // Server-side per-rider numbers. Preferred when present — computed using
  // the same methodology as the lead-rider stats (smoothed series for
  // distance, DB-aggregated GPS speed clamped to 220 km/h, break-aware
  // moving time).
  me: LiveRideMetrics["me"] | undefined;
  // Raw path fallback for the brief window after a deploy where the metrics
  // endpoint hasn't been re-hit yet, or for offline-cached views.
  path: TrackPoint[];
  riderName: string;
}

export function PersonalRideCard({ me, path, riderName }: Props) {
  const fallback = useMemo(
    () => (me ? null : personalRideStats(path)),
    [me, path]
  );
  const source: "server" | "fallback" | null = me
    ? "server"
    : fallback
      ? "fallback"
      : null;
  if (!source) return null;

  const distanceKm = me ? me.distanceKm : fallback!.distanceKm;
  const movingMinutes = me ? me.movingMinutes : fallback!.movingMinutes;
  const avgSpeedKmh = me ? me.avgSpeedKmh : fallback!.avgSpeedKmh;
  const maxSpeedKmh = me ? me.maxSpeedKmh : fallback!.maxSpeedKmh;
  const pointsCount = me ? me.pointsCount : fallback!.pointsCount;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Bike className="h-4 w-4 text-t2w-accent" />
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Your ride · {riderName.split(" ")[0]}
        </h3>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Stat icon={Route} label="Distance" value={`${distanceKm.toFixed(1)} km`} />
        <Stat icon={Clock} label="Moving time" value={formatMinutes(movingMinutes)} />
        <Stat icon={Gauge} label="Avg speed" value={`${avgSpeedKmh.toFixed(1)} km/h`} />
        <Stat icon={TrendingUp} label="Max speed" value={`${maxSpeedKmh.toFixed(0)} km/h`} />
      </div>
      <p className="mt-3 text-[10px] uppercase tracking-widest text-gray-400 dark:text-gray-500">
        {source === "server"
          ? `Server-computed from ${pointsCount} GPS points · ${me!.distanceSource === "smoothed" ? "smoothed track" : "raw track"}`
          : `Estimated from ${pointsCount} GPS pings (server stats unavailable)`}
      </p>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 text-gray-400" />
      <div>
        <p className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-400">
          {label}
        </p>
        <p className="text-sm font-semibold text-gray-800 dark:text-white">
          {value}
        </p>
      </div>
    </div>
  );
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
