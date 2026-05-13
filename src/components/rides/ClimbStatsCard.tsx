"use client";

import { Mountain, TrendingUp } from "lucide-react";
import type { RideAnalytics } from "@/types";

interface Props {
  climb: RideAnalytics["climb"];
  elevation: RideAnalytics["elevation"];
}

export function ClimbStatsCard({ climb, elevation }: Props) {
  const hasClimb = Boolean(climb.longest || climb.steepest);
  const hasElev = Boolean(elevation);
  if (!hasClimb && !hasElev) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Mountain className="h-4 w-4 text-t2w-accent" />
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Elevation insights
        </h3>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {elevation && (
          <>
            <Tile
              label="Net change"
              value={`${elevation.netM > 0 ? "+" : ""}${elevation.netM} m`}
              accent="text-sky-500"
            />
            <Tile
              label="Highest point"
              value={`${elevation.maxM} m`}
              accent="text-emerald-500"
            />
            <Tile
              label="Lowest point"
              value={`${elevation.minM} m`}
              accent="text-amber-500"
            />
            <Tile
              label="Total ascent"
              value={`↑ ${elevation.gainM} / ↓ ${elevation.lossM} m`}
              accent="text-purple-500"
            />
          </>
        )}
      </div>

      {hasClimb && (
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          {climb.longest && (
            <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/5 p-3">
              <div className="flex items-center gap-2 mb-1">
                <Mountain className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-[11px] uppercase tracking-wide text-emerald-500/90 font-semibold">
                  Longest climb
                </span>
              </div>
              <div className="text-lg font-bold text-gray-800 dark:text-white">
                {climb.longest.distanceKm.toFixed(2)} km · +{climb.longest.gainM} m
              </div>
              <div className="text-[11px] text-gray-500 dark:text-gray-400">
                Between {climb.longest.startKm.toFixed(1)}–{climb.longest.endKm.toFixed(1)} km mark
              </div>
            </div>
          )}
          {climb.steepest && (
            <div className="rounded-lg border border-orange-400/30 bg-orange-400/5 p-3">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-3.5 w-3.5 text-orange-500" />
                <span className="text-[11px] uppercase tracking-wide text-orange-500/90 font-semibold">
                  Steepest gradient
                </span>
              </div>
              <div className="text-lg font-bold text-gray-800 dark:text-white">
                {climb.steepest.gradePct.toFixed(1)}% over {(
                  climb.steepest.endKm - climb.steepest.startKm
                ).toFixed(2)} km
              </div>
              <div className="text-[11px] text-gray-500 dark:text-gray-400">
                +{climb.steepest.gainM} m · {climb.steepest.startKm.toFixed(1)}–
                {climb.steepest.endKm.toFixed(1)} km mark
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Tile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="rounded-lg bg-gray-50 dark:bg-gray-700/30 p-2.5">
      <div className={`text-base font-bold ${accent}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 mt-0.5">
        {label}
      </div>
    </div>
  );
}
