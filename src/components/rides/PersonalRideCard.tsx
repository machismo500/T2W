"use client";

import { useMemo } from "react";
import { Bike, Clock, Gauge, Route, TrendingUp } from "lucide-react";
import type { TrackPoint } from "@/types";
import { personalRideStats } from "@/lib/personal-stats";

interface Props {
  path: TrackPoint[];
  riderName: string;
}

// Per-rider summary derived from the user's own GPS pings (myPath). Distinct
// from the lead-rider stats already shown in "Ride Statistics" — this answers
// "how did *I* do?" rather than "what was the convoy's path?".
export function PersonalRideCard({ path, riderName }: Props) {
  const stats = useMemo(() => personalRideStats(path), [path]);

  if (!stats) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Bike className="h-4 w-4 text-t2w-accent" />
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Your ride · {riderName.split(" ")[0]}
        </h3>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Stat
          icon={Route}
          label="Distance"
          value={`${stats.distanceKm.toFixed(1)} km`}
        />
        <Stat
          icon={Clock}
          label="Moving time"
          value={formatMinutes(stats.movingMinutes)}
        />
        <Stat
          icon={Gauge}
          label="Avg speed"
          value={`${stats.avgSpeedKmh.toFixed(1)} km/h`}
        />
        <Stat
          icon={TrendingUp}
          label="Max speed"
          value={`${stats.maxSpeedKmh.toFixed(0)} km/h`}
        />
      </div>
      <p className="mt-3 text-[10px] uppercase tracking-widest text-gray-400 dark:text-gray-500">
        Computed from your own GPS pings · {stats.pointsCount} points
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
