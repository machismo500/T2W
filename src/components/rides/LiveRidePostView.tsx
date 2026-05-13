"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { LiveRideMetrics as Metrics, LiveRideSession, LiveRiderLocation, TrackPoint } from "@/types";
import { LiveRideMap } from "./LiveRideMap";
import { LiveRideMapEditor } from "./LiveRideMapEditor";
import { ElevationProfile } from "./ElevationProfile";
import { TrackScrubber } from "./TrackScrubber";
import { ShareableRideCard, type ShareStatKey } from "./ShareableRideCard";
import { PersonalRideCard } from "./PersonalRideCard";
import { ReliveCard } from "./ReliveCard";
import { api } from "@/lib/api-client";
import { flushLocationQueue, getPendingCount } from "@/lib/location-queue";
import {
  Clock,
  Route,
  Gauge,
  Users,
  TrendingUp,
  Coffee,
  AlertTriangle,
  Mountain,
  Sunrise,
  Sunset,
  Timer,
  Share2,
  Download,
  Pencil,
  RefreshCw,
} from "lucide-react";

interface LiveRidePostViewProps {
  rideId: string;
  rideTitle: string;
  riderName: string;
  plannedRoute?: { lat: number; lng: number }[];
  leadPath: TrackPoint[];
  myPath?: TrackPoint[];
  riders: LiveRiderLocation[];
  metrics: Metrics | null;
  mapsLoaded?: boolean;
  mapError?: string | null;
  startLocation?: { lat: number; lng: number };
  endLocation?: { lat: number; lng: number };
  isSuperAdmin?: boolean;
  // Gate for map / track / stats edits. Defaults to isSuperAdmin for backward
  // compat — pass canEditRideMap from the auth context to also allow core
  // members when the permission is enabled.
  canEditMap?: boolean;
  session?: LiveRideSession | null;
  registrants?: { userId: string; name: string }[];
  onMapDataChanged?: () => void;
}

export function LiveRidePostView({
  rideId,
  rideTitle,
  riderName,
  plannedRoute,
  leadPath,
  myPath = [],
  riders,
  metrics,
  mapsLoaded = true,
  mapError,
  startLocation,
  endLocation,
  isSuperAdmin = false,
  canEditMap,
  session = null,
  registrants = [],
  onMapDataChanged,
}: LiveRidePostViewProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [gpxMenuOpen, setGpxMenuOpen] = useState(false);
  const [pendingPings, setPendingPings] = useState(0);
  const [syncing, setSyncing] = useState(false);

  // Surface queued offline pings from any device-local session so the rider
  // can manually retry the upload from the post-ride view.
  useEffect(() => {
    let cancelled = false;
    getPendingCount(rideId)
      .then((n) => { if (!cancelled) setPendingPings(n); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [rideId]);

  const handleSyncNow = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const flushed = await flushLocationQueue(rideId, (coords) =>
        api.liveSession.submitLocation(rideId, {
          lat: coords.lat,
          lng: coords.lng,
          speed: coords.speed ?? undefined,
          heading: coords.heading ?? undefined,
          accuracy: coords.accuracy ?? undefined,
          recordedAt: coords.recordedAt,
        })
      );
      const remaining = await getPendingCount(rideId);
      setPendingPings(remaining);
      if (flushed === 0 && remaining > 0) {
        alert("Could not sync — the ride may have ended on the server. Queued pings will be cleared.");
      }
    } catch (err) {
      console.error("[T2W] Manual flush failed:", err);
      alert("Sync failed. Check your connection and try again.");
    } finally {
      setSyncing(false);
    }
  };
  // Default the toggle to whichever path actually has data. Solo rides where
  // leadRiderId never matched will land on "mine" automatically.
  const initialView: "lead" | "mine" =
    leadPath.length > 0 ? "lead" : myPath.length > 0 ? "mine" : "lead";
  const [pathView, setPathView] = useState<"lead" | "mine">(initialView);
  const [shareOpen, setShareOpen] = useState(false);
  const [scrubberPos, setScrubberPos] = useState<{
    lat: number;
    lng: number;
    label?: string;
  } | null>(null);
  // Stable callback so TrackScrubber's effect doesn't re-trigger on every
  // parent render — otherwise we hit "Maximum update depth exceeded".
  const handleScrubberPosition = useCallback(
    (
      p: { point: TrackPoint; index: number; cumulativeKm: number } | null
    ) => {
      if (!p) {
        setScrubberPos(null);
        return;
      }
      setScrubberPos({
        lat: p.point.lat,
        lng: p.point.lng,
        label: `${p.cumulativeKm.toFixed(1)} km · ${p.point.recordedAt ?? ""}`,
      });
    },
    []
  );

  // Smoothed track for the active rider, when one has been built post-ride.
  // When present, the map renders this instead of the raw recorded points.
  const activeRiderId = pathView === "lead" ? session?.leadRiderId : undefined;
  const [smoothedPath, setSmoothedPath] = useState<TrackPoint[]>([]);
  useEffect(() => {
    if (!activeRiderId) {
      setSmoothedPath([]);
      return;
    }
    let cancelled = false;
    api.liveSmoothed
      .get(rideId, activeRiderId)
      .then((data) => {
        if (cancelled) return;
        setSmoothedPath(
          (data.points ?? []).map(
            (p: {
              lat: number;
              lng: number;
              recordedAt?: string;
              isInterpolated?: boolean;
              isSnapped?: boolean;
            }) => ({
              lat: p.lat,
              lng: p.lng,
              recordedAt: p.recordedAt,
              isInterpolated: p.isInterpolated,
              isSnapped: p.isSnapped,
            })
          )
        );
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [rideId, activeRiderId, session?.smoothedAt]);

  useEffect(() => {
    // Re-resolve the default if data arrives after first render.
    if (leadPath.length === 0 && myPath.length > 0 && pathView === "lead") {
      setPathView("mine");
    }
  }, [leadPath.length, myPath.length, pathView]);

  const showToggle = leadPath.length > 0 && myPath.length > 0;
  const leadDisabled = leadPath.length === 0;
  const mineDisabled = myPath.length === 0;

  const stats = useMemo(() => buildStats(metrics), [metrics]);

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
        <div className="p-4 border-b dark:border-gray-700 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold dark:text-white">{rideTitle} — Ride Summary</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Post-ride view showing the completed route
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {showToggle && (
              <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 p-0.5 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setPathView("lead")}
                  disabled={leadDisabled}
                  data-testid="path-toggle-lead"
                  className={`px-3 py-1.5 rounded-md transition-colors ${
                    pathView === "lead"
                      ? "bg-green-500/15 text-green-600 dark:text-green-400"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  } ${leadDisabled ? "opacity-40 cursor-not-allowed" : ""}`}
                >
                  Lead&rsquo;s route
                </button>
                <button
                  type="button"
                  onClick={() => setPathView("mine")}
                  disabled={mineDisabled}
                  data-testid="path-toggle-mine"
                  className={`px-3 py-1.5 rounded-md transition-colors ${
                    pathView === "mine"
                      ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  } ${mineDisabled ? "opacity-40 cursor-not-allowed" : ""}`}
                >
                  My route
                </button>
              </div>
            )}
            <div className="relative">
              <button
                type="button"
                onClick={() => setGpxMenuOpen((v) => !v)}
                data-testid="gpx-download-toggle"
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/40"
              >
                <Download className="h-3.5 w-3.5" />
                GPX
              </button>
              {gpxMenuOpen && (
                <div className="absolute right-0 top-full z-30 mt-1 w-44 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs shadow-lg">
                  <a
                    href={api.liveSession.downloadGpxUrl(rideId, "lead")}
                    onClick={() => setGpxMenuOpen(false)}
                    className="block px-3 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/40"
                  >
                    Lead&rsquo;s track
                  </a>
                  <a
                    href={api.liveSession.downloadGpxUrl(rideId, "mine")}
                    onClick={() => setGpxMenuOpen(false)}
                    className="block px-3 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/40"
                  >
                    My track
                  </a>
                  <a
                    href={api.liveSession.downloadGpxUrl(rideId, "planned")}
                    onClick={() => setGpxMenuOpen(false)}
                    className="block px-3 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/40"
                  >
                    Planned route
                  </a>
                </div>
              )}
            </div>
            {pendingPings > 0 && (
              <button
                type="button"
                onClick={handleSyncNow}
                disabled={syncing}
                data-testid="sync-now"
                title="Upload location pings that were captured offline on this device"
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-xs font-medium text-amber-400 hover:bg-amber-400/20 disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Syncing…" : `Sync now (${pendingPings})`}
              </button>
            )}
            {(canEditMap ?? isSuperAdmin) && session && (
              <button
                type="button"
                onClick={() => setEditorOpen(true)}
                data-testid="open-map-editor"
                className="inline-flex items-center gap-1.5 rounded-lg border border-t2w-accent/40 bg-t2w-accent/10 px-3 py-1.5 text-xs font-medium text-t2w-accent hover:bg-t2w-accent/20"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit map &amp; stats
              </button>
            )}
          </div>
        </div>
        <div className="h-[400px] sm:h-[500px]">
          {mapsLoaded ? (
            <LiveRideMap
              plannedRoute={plannedRoute}
              // Render smoothed track when one exists for the active rider —
              // otherwise fall back to the raw recorded path.
              leadPath={
                pathView === "lead" && smoothedPath.length > 0
                  ? smoothedPath
                  : leadPath
              }
              myPath={myPath}
              pathView={pathView}
              riders={riders}
              startLocation={startLocation}
              endLocation={endLocation}
              isEnded
              scrubberPosition={scrubberPos}
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
        {activeRiderId && mapsLoaded && (
          <ElevationProfile rideId={rideId} userId={activeRiderId} className="mt-3" />
        )}
        {mapsLoaded && (() => {
          const replayPath =
            pathView === "lead" && smoothedPath.length > 0
              ? smoothedPath
              : pathView === "lead"
                ? leadPath
                : myPath;
          if (!replayPath || replayPath.length < 2) return null;
          return (
            <TrackScrubber
              path={replayPath}
              className="mt-3"
              onPosition={handleScrubberPosition}
            />
          );
        })()}
      </div>

      {myPath.length >= 2 && (
        <PersonalRideCard path={myPath} riderName={riderName} />
      )}

      <ReliveCard rideId={rideId} />

      {metrics && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Ride Statistics
            </h3>
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              data-testid="open-share-card"
              className="inline-flex items-center gap-1.5 rounded-lg bg-t2w-accent/10 px-3 py-1.5 text-xs font-medium text-t2w-accent hover:bg-t2w-accent/20 transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" />
              Create shareable card
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {stats.map((s) => (
              <StatCard
                key={s.key}
                icon={s.icon}
                label={s.label}
                value={s.value}
                color={s.color}
              />
            ))}
          </div>
        </div>
      )}

      {shareOpen && metrics && (
        <ShareableRideCard
          rideTitle={rideTitle}
          riderName={riderName}
          metrics={metrics}
          onClose={() => setShareOpen(false)}
        />
      )}

      {editorOpen && session && (
        <LiveRideMapEditor
          rideId={rideId}
          session={session}
          riders={riders}
          registrants={registrants}
          initialPlannedRoute={plannedRoute ?? []}
          onClose={() => setEditorOpen(false)}
          onSaved={() => {
            setEditorOpen(false);
            onMapDataChanged?.();
          }}
        />
      )}
    </div>
  );
}

interface StatItem {
  key: ShareStatKey;
  icon: typeof Clock;
  label: string;
  value: string;
  color: string;
}

function buildStats(metrics: Metrics | null): StatItem[] {
  if (!metrics) return [];
  const out: StatItem[] = [
    {
      key: "distance",
      icon: Route,
      label: "Distance",
      value: `${metrics.distanceKm} km`,
      color: "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400",
    },
    {
      key: "movingTime",
      icon: Timer,
      label: "Moving Time",
      value: formatDuration(metrics.movingMinutes),
      color: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400",
    },
    {
      key: "duration",
      icon: Clock,
      label: "Duration",
      value: formatDuration(metrics.elapsedMinutes),
      color: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
    },
    {
      key: "avgSpeed",
      icon: Gauge,
      label: "Avg Speed",
      value: `${metrics.avgSpeedKmh} km/h`,
      color: "bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400",
    },
    {
      key: "maxSpeed",
      icon: TrendingUp,
      label: "Max Speed",
      value: `${metrics.maxSpeedKmh} km/h`,
      color: "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400",
    },
  ];

  if (metrics.elevationGainM != null) {
    out.push({
      key: "elevation",
      icon: Mountain,
      label: "Elevation Gain",
      value: `${metrics.elevationGainM} m`,
      color: "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400",
    });
  }

  out.push({
    key: "stops",
    icon: Coffee,
    label: "Stops",
    value:
      metrics.breakCount > 0
        ? `${metrics.breakCount} (${metrics.breakMinutes} min)`
        : "None",
    color: "bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400",
  });

  if (metrics.startedAt) {
    out.push({
      key: "startTime",
      icon: Sunrise,
      label: "Start",
      value: formatTime(metrics.startedAt),
      color: "bg-sky-50 text-sky-600 dark:bg-sky-900/20 dark:text-sky-400",
    });
  }
  if (metrics.endedAt) {
    out.push({
      key: "endTime",
      icon: Sunset,
      label: "End",
      value: formatTime(metrics.endedAt),
      color: "bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400",
    });
  }

  out.push({
    key: "riders",
    icon: Users,
    label: "Riders Tracked",
    value: String(metrics.riderCount),
    color: "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400",
  });

  return out;
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

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
