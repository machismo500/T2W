"use client";

import { Trophy, Crown, Shield } from "lucide-react";
import type { RideAnalytics } from "@/types";

type SortKey = "distanceKm" | "maxSpeedKmh" | "avgSpeedKmh";

interface Props {
  leaderboard: RideAnalytics["leaderboard"];
  sortBy?: SortKey;
}

export function RiderLeaderboardCard({ leaderboard, sortBy = "distanceKm" }: Props) {
  if (leaderboard.length === 0) return null;
  const sorted = [...leaderboard].sort((a, b) => b[sortBy] - a[sortBy]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="h-4 w-4 text-t2w-accent" />
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Rider leaderboard
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
            <tr>
              <th className="text-left font-medium pb-2 pr-2">#</th>
              <th className="text-left font-medium pb-2 pr-2">Rider</th>
              <th className="text-right font-medium pb-2 px-2">Distance</th>
              <th className="text-right font-medium pb-2 px-2 hidden sm:table-cell">Avg</th>
              <th className="text-right font-medium pb-2 px-2">Max</th>
              <th className="text-right font-medium pb-2 px-2 hidden sm:table-cell">
                Time
              </th>
              <th className="text-right font-medium pb-2 pl-2 hidden md:table-cell">
                Devs
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr
                key={r.userId}
                className="border-t border-gray-100 dark:border-gray-700/40 text-gray-700 dark:text-gray-200"
              >
                <td className="py-2 pr-2 font-mono text-xs text-gray-500">
                  {i + 1}
                </td>
                <td className="py-2 pr-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="truncate font-medium">{r.name}</span>
                    {r.isLead && (
                      <span title="Lead rider">
                        <Crown className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      </span>
                    )}
                    {r.isSweep && (
                      <span title="Sweep rider">
                        <Shield className="h-3.5 w-3.5 text-sky-500 shrink-0" />
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-2 px-2 text-right font-mono text-xs">
                  {r.distanceKm.toFixed(1)} km
                </td>
                <td className="py-2 px-2 text-right font-mono text-xs hidden sm:table-cell">
                  {r.avgSpeedKmh.toFixed(1)}
                </td>
                <td className="py-2 px-2 text-right font-mono text-xs">
                  {r.maxSpeedKmh.toFixed(1)}
                </td>
                <td className="py-2 px-2 text-right font-mono text-xs hidden sm:table-cell">
                  {formatMins(r.movingMinutes)}
                </td>
                <td
                  className={`py-2 pl-2 text-right font-mono text-xs hidden md:table-cell ${
                    r.deviationCount > 0 ? "text-amber-500" : "text-gray-400"
                  }`}
                >
                  {r.deviationCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] text-gray-500 dark:text-gray-400">
        Distance is measured from each rider&apos;s own GPS track. Avg speed is
        distance ÷ time-on-track (not a moving average), so it&apos;s comparable
        across the group.
      </p>
    </div>
  );
}

function formatMins(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
