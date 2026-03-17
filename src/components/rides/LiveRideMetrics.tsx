"use client";

import { Clock, Route, Gauge, Users, Coffee, TrendingUp } from "lucide-react";
import type { LiveRideMetrics as Metrics } from "@/types";

interface LiveRideMetricsProps {
  metrics: Metrics | null;
  isLoading?: boolean;
}

export function LiveRideMetrics({ metrics, isLoading }: LiveRideMetricsProps) {
  if (!metrics && !isLoading) return null;

  const items = metrics
    ? [
        {
          icon: Clock,
          label: "Elapsed",
          value: formatDuration(metrics.elapsedMinutes),
          color: "text-blue-600",
        },
        {
          icon: Route,
          label: "Distance",
          value: `${metrics.distanceKm} km`,
          color: "text-green-600",
        },
        {
          icon: Gauge,
          label: "Avg Speed",
          value: `${metrics.avgSpeedKmh} km/h`,
          color: "text-purple-600",
        },
        {
          icon: TrendingUp,
          label: "Max Speed",
          value: `${metrics.maxSpeedKmh} km/h`,
          color: "text-red-600",
        },
        {
          icon: Users,
          label: "Riders",
          value: String(metrics.riderCount),
          color: "text-indigo-600",
        },
        {
          icon: Coffee,
          label: "Breaks",
          value: metrics.breakCount > 0
            ? `${metrics.breakCount} (${metrics.breakMinutes} min)`
            : "None",
          color: "text-orange-600",
        },
      ]
    : [];

  return (
    <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-xl shadow-lg p-3">
      <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
        Ride Metrics
      </h3>
      {isLoading && !metrics ? (
        <div className="text-sm text-gray-400">Loading metrics...</div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {items.map((item) => (
            <div key={item.label} className="text-center">
              <item.icon
                className={`w-4 h-4 mx-auto mb-0.5 ${item.color}`}
              />
              <div className="text-sm font-bold dark:text-white">
                {item.value}
              </div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400">
                {item.label}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
