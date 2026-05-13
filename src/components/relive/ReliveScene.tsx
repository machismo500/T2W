"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Pause, Play, RotateCcw, Download, Film } from "lucide-react";
import type { LiveRideMetrics, TrackPoint } from "@/types";
import {
  buildReliveScript,
  type ReliveScript,
  type ReliveFrameState,
} from "@/lib/relive/animation-script";
import { decimatePath } from "@/lib/geo-utils";
import { ReliveExportPanel } from "./ReliveExportPanel";

// Cap the rendered polyline at 600 points — enough to keep the camera path
// smooth on any realistic ride length while keeping per-frame draws cheap.
const MAX_RENDER_POINTS = 600;
const MAPBOX_STYLE = "mapbox://styles/mapbox/satellite-streets-v12";
const TERRAIN_SOURCE = "mapbox-dem";

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
  path: TrackPoint[];
  metrics: LiveRideMetrics | null;
  breaks: { startedAt: string; endedAt?: string; reason?: string | null }[];
}

declare global {
  interface Window {
    __relive_ready?: boolean;
    __relive_done?: boolean;
  }
}

export function ReliveScene(props: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const rafRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);
  const pausedAtRef = useRef<number | null>(null);
  const styleReadyRef = useRef(false);
  const [playing, setPlaying] = useState<boolean>(props.headless);
  const [frame, setFrame] = useState<ReliveFrameState | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [tokenMissing, setTokenMissing] = useState(false);

  const script: ReliveScript | null = useMemo(() => {
    try {
      const decimated = decimatePath(props.path, MAX_RENDER_POINTS);
      return buildReliveScript({
        path: decimated.map((p) => ({
          lat: p.lat,
          lng: p.lng,
          speed: p.speed ?? null,
          recordedAt: p.recordedAt,
        })),
        breaks: props.breaks,
        totalDistanceKm: props.metrics?.distanceKm ?? 0,
        totalElevationGainM: props.elevationGainM,
        durationSec: props.durationSec,
      });
    } catch {
      return null;
    }
  }, [props.path, props.breaks, props.metrics, props.elevationGainM, props.durationSec]);

  // Mount Mapbox once script is built. Keep the map instance for the lifetime
  // of the component; we re-drive it from the timeline on each frame.
  useEffect(() => {
    if (!script || !containerRef.current) return;
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      setTokenMissing(true);
      return;
    }
    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: MAPBOX_STYLE,
      center: [
        (script.bounds[0] + script.bounds[2]) / 2,
        (script.bounds[1] + script.bounds[3]) / 2,
      ],
      zoom: 4,
      pitch: 0,
      bearing: 0,
      interactive: !props.headless,
      attributionControl: !props.headless,
      preserveDrawingBuffer: true, // required for canvas.captureStream() recording
    });
    mapRef.current = map;

    const drawnCoords: [number, number][] = script.path.map((p) => [p.lng, p.lat]);

    map.on("load", () => {
      map.addSource(TERRAIN_SOURCE, {
        type: "raster-dem",
        url: "mapbox://mapbox.terrain-rgb",
        tileSize: 512,
        maxzoom: 14,
      });
      map.setTerrain({ source: TERRAIN_SOURCE, exaggeration: 1.4 });
      map.setFog({
        color: "rgb(186, 210, 235)",
        "high-color": "rgb(36, 92, 223)",
        "horizon-blend": 0.02,
        "space-color": "rgb(11, 11, 25)",
        "star-intensity": 0.6,
      });

      map.addSource("route-full", {
        type: "geojson",
        data: {
          type: "Feature",
          geometry: { type: "LineString", coordinates: drawnCoords },
          properties: {},
        },
      });
      map.addSource("route-progress", {
        type: "geojson",
        data: {
          type: "Feature",
          geometry: { type: "LineString", coordinates: [drawnCoords[0]] },
          properties: {},
        },
      });

      map.addLayer({
        id: "route-full-line",
        type: "line",
        source: "route-full",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "rgba(255, 255, 255, 0.35)",
          "line-width": 3,
        },
      });
      map.addLayer({
        id: "route-progress-line",
        type: "line",
        source: "route-progress",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#facc15",
          "line-width": 5,
          "line-blur": 0.5,
        },
      });

      styleReadyRef.current = true;
      window.__relive_ready = true;
      if (props.headless) {
        // Headless mode: the worker is screencasting — start playing on the
        // next frame so the very first captured frame is at t≈0.
        setPlaying(true);
      }
    });

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      map.remove();
      mapRef.current = null;
      styleReadyRef.current = false;
    };
  }, [script, props.headless]);

  // Drive the animation. We compute virtual elapsed time from a wall-clock
  // anchor so the timing stays correct even if a frame is missed; in headless
  // mode the renderer wants deterministic timing, but real-time is acceptable
  // because the worker captures the canvas via screencast at fixed FPS.
  useEffect(() => {
    if (!script || !mapRef.current || !playing) return;
    let cancelled = false;

    const tick = (now: number) => {
      if (cancelled) return;
      const elapsedSec = (now - startedAtRef.current) / 1000;
      const f = script.getStateAtTime(elapsedSec);
      setFrame(f);

      const map = mapRef.current!;
      if (styleReadyRef.current) {
        map.jumpTo({
          center: [f.camera.lng, f.camera.lat],
          bearing: f.camera.bearing,
          pitch: f.camera.pitch,
          zoom: f.camera.zoom,
        });

        if (f.phase === "flyover" || f.phase === "outro") {
          // Update progress polyline to the path index that matches the
          // current flyover-fraction. We rebuild a sliced LineString rather
          // than a `line-gradient` interpolation to keep the implementation
          // simple and to support resume/scrub later.
          const cum = script.cumKm;
          const totalKm = cum[cum.length - 1] || 0.001;
          const targetKm = f.flyoverProgress * totalKm;
          let cut = 1;
          for (let i = 1; i < cum.length; i++) {
            if (cum[i] >= targetKm) {
              cut = i + 1;
              break;
            }
            cut = i + 1;
          }
          const sliced = script.path
            .slice(0, cut)
            .map((p) => [p.lng, p.lat] as [number, number]);
          if (sliced.length >= 2) {
            const src = map.getSource("route-progress") as mapboxgl.GeoJSONSource | undefined;
            src?.setData({
              type: "Feature",
              geometry: { type: "LineString", coordinates: sliced },
              properties: {},
            });
          }
        }
      }

      if (elapsedSec >= script.durationSec) {
        setPlaying(false);
        window.__relive_done = true;
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    if (pausedAtRef.current != null) {
      // Resuming: shift the anchor so elapsed time picks up where we paused.
      const pauseDuration = performance.now() - pausedAtRef.current;
      startedAtRef.current += pauseDuration;
      pausedAtRef.current = null;
    } else if (startedAtRef.current === 0) {
      startedAtRef.current = performance.now();
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [script, playing]);

  const handleRestart = useCallback(() => {
    startedAtRef.current = 0;
    pausedAtRef.current = null;
    window.__relive_done = false;
    setPlaying(true);
  }, []);

  const handleTogglePlay = useCallback(() => {
    setPlaying((p) => {
      const next = !p;
      if (!next) pausedAtRef.current = performance.now();
      return next;
    });
  }, []);

  const aspectClass =
    props.orientation === "portrait"
      ? "aspect-[9/16] w-full max-w-md"
      : "aspect-video w-full max-w-6xl";

  if (tokenMissing) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center">
        <p className="text-sm font-semibold text-white">
          Mapbox token is not configured
        </p>
        <p className="mt-2 text-xs text-t2w-muted">
          Set <code className="rounded bg-t2w-surface px-1">NEXT_PUBLIC_MAPBOX_TOKEN</code>{" "}
          in your environment to enable the Relive flyover.
        </p>
      </div>
    );
  }

  if (!script) {
    return (
      <div className="px-4 py-12 text-center text-sm text-t2w-muted">
        Couldn&rsquo;t build a flyover script for this ride.
      </div>
    );
  }

  return (
    <div className={props.headless ? "h-full w-full" : "mx-auto px-4 py-6"}>
      <div className={props.headless ? "h-full w-full" : `mx-auto ${aspectClass}`}>
        <div
          ref={containerRef}
          data-testid="relive-map"
          className="relative h-full w-full overflow-hidden rounded-2xl bg-black"
        >
          {/* Intro / outro / HUD overlays */}
          {frame && (
            <ReliveOverlays
              frame={frame}
              rideTitle={props.rideTitle}
              rideNumber={props.rideNumber}
              startDate={props.startDate}
              startLocation={props.startLocation}
              endLocation={props.endLocation}
              metrics={props.metrics}
              elevationGainM={props.elevationGainM}
              durationSec={script.durationSec}
              outroSec={script.outroSec}
              introSec={script.introSec}
            />
          )}
        </div>
      </div>

      {!props.headless && (
        <div className="mx-auto mt-4 flex max-w-6xl flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={handleTogglePlay}
            className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/15"
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {playing ? "Pause" : "Play"}
          </button>
          <button
            type="button"
            onClick={handleRestart}
            className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/15"
          >
            <RotateCcw className="h-4 w-4" />
            Restart
          </button>
          <button
            type="button"
            onClick={() => setExportOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-t2w-accent px-4 py-2 text-sm font-medium text-black hover:bg-t2w-accent/90"
          >
            <Download className="h-4 w-4" />
            Download video
          </button>
        </div>
      )}

      {exportOpen && (
        <ReliveExportPanel
          rideId={props.rideId}
          orientation={props.orientation}
          getCanvas={() =>
            (mapRef.current?.getCanvas() as HTMLCanvasElement | undefined) || null
          }
          durationSec={script.durationSec}
          onClose={() => setExportOpen(false)}
        />
      )}
    </div>
  );
}

interface OverlayProps {
  frame: ReliveFrameState;
  rideTitle: string;
  rideNumber: string;
  startDate: string;
  startLocation: string;
  endLocation: string;
  metrics: LiveRideMetrics | null;
  elevationGainM: number | null;
  durationSec: number;
  introSec: number;
  outroSec: number;
}

function ReliveOverlays({
  frame,
  rideTitle,
  rideNumber,
  startDate,
  startLocation,
  endLocation,
  metrics,
  elevationGainM,
}: OverlayProps) {
  const dateFmt = new Date(startDate).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  if (frame.phase === "intro") {
    const opacity = Math.min(1, frame.phaseProgress * 2);
    return (
      <div
        className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-black/60 via-transparent to-black/40 px-6 text-center"
        style={{ opacity }}
      >
        <p className="text-xs uppercase tracking-[0.3em] text-t2w-accent">
          {rideNumber}
        </p>
        <h1 className="mt-2 max-w-xl text-3xl font-bold text-white sm:text-4xl">
          {rideTitle}
        </h1>
        <p className="mt-3 text-sm text-white/80">
          {startLocation} → {endLocation}
        </p>
        <p className="mt-1 text-xs text-white/60">{dateFmt}</p>
      </div>
    );
  }

  if (frame.phase === "outro") {
    const opacity = Math.min(1, frame.phaseProgress * 2);
    return (
      <div
        className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-black/40 via-black/30 to-black/70 px-6 text-center"
        style={{ opacity }}
      >
        <Film className="h-10 w-10 text-t2w-accent" />
        <h2 className="mt-3 text-2xl font-bold text-white sm:text-3xl">
          {rideTitle}
        </h2>
        <div className="mt-5 grid grid-cols-3 gap-6 text-white">
          <OutroStat label="Distance" value={`${frame.hud.kmCovered.toFixed(0)} km`} />
          <OutroStat
            label="Moving time"
            value={
              metrics
                ? formatHrs(metrics.movingMinutes)
                : formatHrs(frame.hud.elapsedSec / 60)
            }
          />
          <OutroStat
            label="Elevation"
            value={`${(elevationGainM ?? frame.hud.elevGainedM).toFixed(0)} m`}
          />
        </div>
        <p className="mt-6 text-[10px] uppercase tracking-[0.3em] text-white/60">
          Created with Tales on 2 Wheels · © Mapbox © OpenStreetMap
        </p>
      </div>
    );
  }

  // Flyover HUD
  return (
    <>
      <div className="pointer-events-none absolute left-4 top-4 rounded-xl bg-black/55 px-4 py-3 text-white shadow-lg backdrop-blur">
        <p className="text-[10px] uppercase tracking-widest text-white/60">
          {rideNumber} · {dateFmt}
        </p>
        <p className="mt-0.5 text-sm font-semibold">{rideTitle}</p>
      </div>

      <div className="pointer-events-none absolute bottom-4 left-4 right-4 flex flex-wrap items-end justify-between gap-3">
        <div className="grid grid-cols-3 gap-3 rounded-xl bg-black/55 px-4 py-3 text-white shadow-lg backdrop-blur">
          <HudStat label="Distance" value={`${frame.hud.kmCovered.toFixed(1)} km`} />
          <HudStat
            label="Speed"
            value={
              frame.hud.currentSpeedKmh != null
                ? `${Math.round(frame.hud.currentSpeedKmh)} km/h`
                : "—"
            }
          />
          <HudStat
            label="Elevation"
            value={`${frame.hud.elevGainedM.toFixed(0)} m`}
          />
        </div>
        {frame.activeHighlight && (
          <div className="rounded-full bg-t2w-accent/90 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-black shadow-lg">
            {frame.activeHighlight.label}
          </div>
        )}
      </div>
    </>
  );
}

function HudStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-white/60">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

function OutroStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-white/60">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}

function formatHrs(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
