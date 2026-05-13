"use client";

import { Users, AlertTriangle, Maximize2, Sigma } from "lucide-react";
import type { RideAnalytics } from "@/types";

interface Props {
  cohesion: NonNullable<RideAnalytics["cohesion"]>;
}

export function GroupCohesionCard({ cohesion }: Props) {
  const togetherColor =
    cohesion.togetherPct >= 75
      ? "text-emerald-500"
      : cohesion.togetherPct >= 50
        ? "text-amber-500"
        : "text-red-500";

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Users className="h-4 w-4 text-t2w-accent" />
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Group cohesion
        </h3>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat
          icon={<Sigma className="h-4 w-4" />}
          label={`Together (<${cohesion.togetherThresholdKm} km)`}
          value={`${cohesion.togetherPct}%`}
          accent={togetherColor}
        />
        <Stat
          icon={<Maximize2 className="h-4 w-4" />}
          label="Max gap to lead"
          value={`${cohesion.maxGapKm.toFixed(2)} km`}
          accent="text-orange-500"
        />
        <Stat
          icon={<Users className="h-4 w-4" />}
          label="Typical gap"
          value={`${cohesion.medianGapKm.toFixed(2)} km`}
          accent="text-sky-500"
        />
        <Stat
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Deviation events"
          value={String(cohesion.deviationEvents)}
          accent={cohesion.deviationEvents > 0 ? "text-amber-500" : "text-emerald-500"}
        />
      </div>

      <p className="mt-3 text-[11px] text-gray-500 dark:text-gray-400">
        Sampled across {cohesion.riderCount} tracked rider
        {cohesion.riderCount === 1 ? "" : "s"} every 30 s, measured against the lead rider.
      </p>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="rounded-lg bg-gray-50 dark:bg-gray-700/30 p-2.5">
      <div className={`flex items-center gap-1.5 mb-1 ${accent}`}>{icon}</div>
      <div className={`text-base font-bold ${accent}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 mt-0.5">
        {label}
      </div>
    </div>
  );
}
