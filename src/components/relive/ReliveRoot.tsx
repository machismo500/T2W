"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api-client";
import type { LiveRideMetrics, TrackPoint } from "@/types";

// Mapbox pulls in WebGL, terrain DEM and a 700kb bundle — load it only when
// the page is interactive in the browser. This also keeps the relive page out
// of the SSR critical path so the rest of the app isn't slowed by it.
const ReliveScene = dynamic(
  () => import("./ReliveScene").then((m) => m.ReliveScene),
  { ssr: false }
);

interface Props {
  rideId: string;
  rideTitle: string;
  rideNumber: string;
  startDate: string;
  startLocation: string;
  endLocation: string;
  sessionEnded: boolean;
  elevationGainM: number | null;
  headless: boolean;
  orientation: "landscape" | "portrait";
  durationSec: number;
  exportId?: string;
}

interface LiveData {
  leadPath: TrackPoint[];
  metrics: LiveRideMetrics | null;
  breaks: { startedAt: string; endedAt?: string; reason?: string | null }[];
}

export function ReliveRoot(props: Props) {
  const [data, setData] = useState<LiveData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [live, metricsRes] = await Promise.all([
          api.liveSession.get(props.rideId),
          fetch(`/api/rides/${props.rideId}/live/metrics`, { credentials: "include" })
            .then((r) => (r.ok ? r.json() : { metrics: null }))
            .catch(() => ({ metrics: null })),
        ]);
        if (cancelled) return;
        type BreakRow = {
          startedAt: string;
          endedAt?: string;
          reason?: string | null;
        };
        const breaks = ((live.session?.breaks || []) as BreakRow[]).map((b) => ({
          startedAt: b.startedAt,
          endedAt: b.endedAt,
          reason: b.reason ?? null,
        }));
        setData({
          leadPath: live.leadPath || [],
          metrics: metricsRes.metrics || null,
          breaks,
        });
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load ride data");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.rideId]);

  if (error) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm font-medium text-white">Couldn&rsquo;t load the ride</p>
        <p className="text-xs text-t2w-muted">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-t2w-muted">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p className="text-xs">Building your flyover…</p>
      </div>
    );
  }

  if (data.leadPath.length < 2) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-base font-semibold text-white">
          Not enough GPS data to build a flyover yet
        </p>
        <p className="max-w-md text-xs text-t2w-muted">
          Once the lead rider has a few minutes of recorded track, this page will
          animate the route in 3D. Check back after the ride is fully tracked.
        </p>
      </div>
    );
  }

  return (
    <ReliveScene
      rideId={props.rideId}
      rideTitle={props.rideTitle}
      rideNumber={props.rideNumber}
      startDate={props.startDate}
      startLocation={props.startLocation}
      endLocation={props.endLocation}
      sessionEnded={props.sessionEnded}
      elevationGainM={props.elevationGainM}
      headless={props.headless}
      orientation={props.orientation}
      durationSec={props.durationSec}
      exportId={props.exportId}
      path={data.leadPath}
      metrics={data.metrics}
      breaks={data.breaks}
    />
  );
}
