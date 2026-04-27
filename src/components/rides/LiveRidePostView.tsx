"use client";

import type { LiveRideMetrics as Metrics, LiveRiderLocation } from "@/types";
import { LiveRideMap } from "./LiveRideMap";
import { Clock, Route, Gauge, Users, TrendingUp, Coffee, AlertTriangle } from "lucide-react";

interface LiveRidePostViewProps {
  rideTitle: string;
  plannedRoute?: { lat: number; lng: number }[];
  leadPath: { lat: number; lng: number }[];
  riders: LiveRiderLocation[];
  metrics: Metrics | null;
  mapsLoaded?: boolean;
  mapError?: string | null;
  startLocation?: { lat: number; lng: number };
  endLocation?: { lat: number; lng: number };
}

export function LiveRidePostView({
  rideTitle,
  plannedRoute,
  leadPath,
  riders,
  metrics,
  mapsLoaded = true,
  mapError,
  startLocation,
  endLocation,
}: LiveRidePostViewProps) {
  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
        <div className="p-4 border-b dark:border-gray-700">
          <h2 className="text-lg font-bold dark:text-white">{rideTitle} — Ride Summary</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Post-ride view showing the completed route
          </p>
        </div>
        <div className="h-[400px] sm:h-[500px]">
          {mapsLoaded ? (
            <LiveRideMap
              plannedRoute={plannedRoute}
              leadPath={leadPath}
              riders={riders}
              startLocation={startLocation}
              endLocation={endLocation}
              isEnded
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-gray-100 dark:bg-gray-800/40">
              <div className="max-w-xs text-center px-6">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/15 text-orange-500">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  {mapError ?? "Map unavailable"}
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Ride statistics are shown below.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {metrics && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4">
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            Ride Statistics
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <StatCard
              icon={Clock}
              label="Duration"
              value={formatDuration(metrics.elapsedMinutes)}
              color="bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
            />
            <StatCard
              icon={Route}
              label="Distance"
              value={`${metrics.distanceKm} km`}
              color="bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400"
            />
            <StatCard
              icon={Gauge}
              label="Avg Speed"
              value={`${metrics.avgSpeedKmh} km/h`}
              color="bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400"
            />
            <StatCard
              icon={TrendingUp}
              label="Max Speed"
              value={`${metrics.maxSpeedKmh} km/h`}
              color="bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"
            />
            <StatCard
              icon={Users}
              label="Riders Tracked"
              value={String(metrics.riderCount)}
              color="bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400"
            />
            <StatCard
              icon={Coffee}
              label="Breaks"
              value={
                metrics.breakCount > 0
                  ? `${metrics.breakCount} (${metrics.breakMinutes} min)`
                  : "None"
              }
              color="bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className={`rounded-lg p-3 ${color}`}>
      <Icon className="w-5 h-5 mb-1" />
      <div className="text-lg font-bold">{value}</div>
      <div className="text-xs opacity-75">{label}</div>
    </div>
  );
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
