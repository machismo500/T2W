"use client";

import { useMemo } from "react";
import { Timer } from "lucide-react";
import type { RideAnalytics } from "@/types";

interface Props {
  splits: RideAnalytics["splits"];
}

/**
 * Per-km splits table with a heat-bar showing relative pace. Adapted to
 * mobile by capping the visible rows to the first ~15 and stacking via the
 * existing post-ride scroll container — pop the full list inline below.
 */
export function PaceSplitsCard({ splits }: Props) {
  const { fastest, slowest, hasElev } = useMemo(() => {
    if (splits.length === 0) {
      return { fastest: 0, slowest: 0, hasElev: false };
    }
    let f = -Infinity;
    let s = Infinity;
    let elev = false;
    for (const sp of splits) {
      if (sp.avgSpeedKmh > f) f = sp.avgSpeedKmh;
      if (sp.avgSpeedKmh < s) s = sp.avgSpeedKmh;
      if (sp.elevGainM != null || sp.elevLossM != null) elev = true;
    }
    return { fastest: f, slowest: s, hasElev: elev };
  }, [splits]);

  if (splits.length === 0) return null;
  const speedSpan = Math.max(0.1, fastest - slowest);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-t2w-accent" />
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Pace splits
          </h3>
        </div>
        <span className="text-[11px] text-gray-500 dark:text-gray-400">
          {splits.length} km · 1 km buckets
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
            <tr>
              <th className="text-left font-medium pb-2 pr-2">Km</th>
              <th className="text-right font-medium pb-2 px-2">Time</th>
              <th className="text-right font-medium pb-2 px-2">Avg</th>
              {hasElev && (
                <>
                  <th className="text-right font-medium pb-2 px-2">↑ m</th>
                  <th className="text-right font-medium pb-2 px-2">↓ m</th>
                </>
              )}
              <th className="text-left font-medium pb-2 pl-2 w-[40%]">Pace</th>
            </tr>
          </thead>
          <tbody>
            {splits.map((s) => {
              const ratio =
                speedSpan > 0
                  ? (s.avgSpeedKmh - slowest) / speedSpan
                  : 0.5;
              const widthPct = Math.max(8, Math.min(100, ratio * 100));
              const isFastest = s.avgSpeedKmh === fastest;
              const isSlowest = s.avgSpeedKmh === slowest && fastest !== slowest;
              return (
                <tr
                  key={s.index}
                  className="border-t border-gray-100 dark:border-gray-700/40 text-gray-700 dark:text-gray-200"
                >
                  <td className="py-1.5 pr-2 font-mono text-[11px]">
                    {s.index}
                    {s.distanceKm < 0.95 && (
                      <span className="ml-1 text-[10px] text-gray-400">
                        ({s.distanceKm.toFixed(2)}km)
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono">
                    {formatClock(s.durationSec)}
                  </td>
                  <td
                    className={`py-1.5 px-2 text-right font-mono ${
                      isFastest
                        ? "text-emerald-500 font-bold"
                        : isSlowest
                          ? "text-amber-500"
                          : ""
                    }`}
                  >
                    {s.avgSpeedKmh.toFixed(1)}
                  </td>
                  {hasElev && (
                    <>
                      <td className="py-1.5 px-2 text-right text-emerald-500/80 font-mono">
                        {s.elevGainM ?? "—"}
                      </td>
                      <td className="py-1.5 px-2 text-right text-orange-400/80 font-mono">
                        {s.elevLossM ?? "—"}
                      </td>
                    </>
                  )}
                  <td className="py-1.5 pl-2">
                    <div className="relative h-2 w-full rounded-full bg-gray-100 dark:bg-gray-700/30">
                      <div
                        className={`absolute inset-y-0 left-0 rounded-full ${
                          isFastest
                            ? "bg-emerald-500"
                            : isSlowest
                              ? "bg-amber-500"
                              : "bg-t2w-accent/70"
                        }`}
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatClock(sec: number): string {
  if (sec < 60) return `0:${String(sec).padStart(2, "0")}`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
