"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Film, Download, Loader2, Play, Square } from "lucide-react";
import type { TrackPoint } from "@/types";

const W = 1080;
const H = 1080; // square — works well on IG, WhatsApp, X
const DRAW_DURATION_MS = 6000;
const HOLD_MS = 1500;
const FPS = 30;

interface Props {
  rideTitle: string;
  riderName: string;
  path: TrackPoint[];
  distanceKm: number;
  movingMinutes: number;
  maxSpeedKmh: number;
}

/**
 * Lightweight, in-browser "Highlight Reel" — animates the recorded polyline
 * drawing itself in over ~6 s, holds for ~1.5 s, then writes a WebM video
 * the rider can save / share. WebM via MediaRecorder is universally
 * supported on Chromium/WebKit, ~10× smaller than an equivalent GIF, and
 * WhatsApp/Instagram both auto-loop it like a GIF when shared in chats.
 *
 * Falls back to a still PNG export when MediaRecorder isn't available
 * (some older iOS Safari builds), so users still get something shareable.
 */
export function HighlightReel({
  rideTitle,
  riderName,
  path,
  distanceKm,
  movingMinutes,
  maxSpeedKmh,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [progress, setProgress] = useState(0); // 0–1 during render
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [fallbackPng, setFallbackPng] = useState<string | null>(null);

  // Project lat/lng → canvas coords once. The recording, render, and
  // preview all share these projected points.
  const projected = useProjected(path);

  // Preview animation — runs once on mount and on play.
  useEffect(() => {
    if (!canvasRef.current || projected.length === 0) return;
    drawFrame(canvasRef.current, projected, 1, { rideTitle, riderName, distanceKm, movingMinutes, maxSpeedKmh });
  }, [projected, rideTitle, riderName, distanceKm, movingMinutes, maxSpeedKmh]);

  // Cancel any in-flight RAF when unmounting.
  useEffect(() => {
    return () => {
      if (animFrameRef.current != null) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const playPreview = useCallback(() => {
    if (!canvasRef.current || playing || rendering) return;
    setPlaying(true);
    const ctx = canvasRef.current;
    const start = performance.now();
    const step = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / DRAW_DURATION_MS);
      drawFrame(ctx, projected, t, { rideTitle, riderName, distanceKm, movingMinutes, maxSpeedKmh });
      if (t < 1) {
        animFrameRef.current = requestAnimationFrame(step);
      } else {
        setPlaying(false);
      }
    };
    animFrameRef.current = requestAnimationFrame(step);
  }, [projected, playing, rendering, rideTitle, riderName, distanceKm, movingMinutes, maxSpeedKmh]);

  const stopPreview = useCallback(() => {
    if (animFrameRef.current != null) cancelAnimationFrame(animFrameRef.current);
    setPlaying(false);
    if (canvasRef.current) {
      drawFrame(canvasRef.current, projected, 1, { rideTitle, riderName, distanceKm, movingMinutes, maxSpeedKmh });
    }
  }, [projected, rideTitle, riderName, distanceKm, movingMinutes, maxSpeedKmh]);

  const recordReel = useCallback(async () => {
    if (!canvasRef.current || rendering || projected.length === 0) return;
    setRendering(true);
    setVideoUrl(null);
    setFallbackPng(null);
    setProgress(0);

    const canvas = canvasRef.current;

    // MediaRecorder support varies by browser — captureStream itself can
    // also be missing on stripped-down Safari builds. If anything fails,
    // fall back to a still PNG so the user still gets a shareable artifact.
    type CanvasWithCapture = HTMLCanvasElement & {
      captureStream?: (fps: number) => MediaStream;
    };
    const cwc = canvas as CanvasWithCapture;
    if (!cwc.captureStream || typeof MediaRecorder === "undefined") {
      drawFrame(canvas, projected, 1, { rideTitle, riderName, distanceKm, movingMinutes, maxSpeedKmh });
      const blob = await new Promise<Blob | null>((r) =>
        canvas.toBlob(r, "image/png")
      );
      if (blob) setFallbackPng(URL.createObjectURL(blob));
      setRendering(false);
      return;
    }

    const stream = cwc.captureStream(FPS);
    const mimeType = pickMime();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };
    const done = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });

    recorder.start();
    const start = performance.now();
    const total = DRAW_DURATION_MS + HOLD_MS;

    await new Promise<void>((resolve) => {
      const step = (now: number) => {
        const elapsed = now - start;
        const drawT = Math.min(1, elapsed / DRAW_DURATION_MS);
        drawFrame(canvas, projected, drawT, { rideTitle, riderName, distanceKm, movingMinutes, maxSpeedKmh });
        setProgress(Math.min(1, elapsed / total));
        if (elapsed < total) {
          animFrameRef.current = requestAnimationFrame(step);
        } else {
          resolve();
        }
      };
      animFrameRef.current = requestAnimationFrame(step);
    });

    recorder.stop();
    await done;
    const outBlob = new Blob(chunks, { type: mimeType || "video/webm" });
    setVideoUrl(URL.createObjectURL(outBlob));
    setRendering(false);
    setProgress(1);
  }, [projected, rendering, rideTitle, riderName, distanceKm, movingMinutes, maxSpeedKmh]);

  if (path.length < 2) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Film className="h-4 w-4 text-t2w-accent" />
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Highlight reel
          </h3>
        </div>
        <span className="text-[11px] text-gray-500 dark:text-gray-400">
          ~7s loop · {Math.round((DRAW_DURATION_MS + HOLD_MS) / 1000)}s clip
        </span>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative w-full sm:w-[280px] shrink-0">
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            className="w-full h-auto rounded-lg bg-black shadow-inner"
            style={{ aspectRatio: "1 / 1" }}
            data-testid="highlight-reel-canvas"
          />
          {rendering && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
              <div className="text-white text-xs flex flex-col items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Rendering {Math.round(progress * 100)}%
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col gap-3 min-w-0">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            A 7-second clip that draws your route in real time — perfect for
            stories, statuses, and chat groups. The clip is generated on your
            device, so nothing is uploaded.
          </p>

          <div className="flex flex-wrap gap-2">
            {!playing ? (
              <button
                type="button"
                onClick={playPreview}
                disabled={rendering}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-white hover:bg-white/20 disabled:opacity-50"
              >
                <Play className="h-3.5 w-3.5" />
                Preview
              </button>
            ) : (
              <button
                type="button"
                onClick={stopPreview}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-white hover:bg-white/20"
              >
                <Square className="h-3.5 w-3.5" />
                Stop
              </button>
            )}
            <button
              type="button"
              onClick={recordReel}
              disabled={rendering}
              data-testid="highlight-reel-render"
              className="inline-flex items-center gap-1.5 rounded-lg bg-t2w-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-t2w-accent/90 disabled:opacity-60"
            >
              {rendering ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Film className="h-3.5 w-3.5" />
              )}
              {rendering ? "Rendering…" : "Render & save"}
            </button>
          </div>

          {videoUrl && (
            <div className="flex flex-col gap-2 rounded-lg border border-emerald-400/40 bg-emerald-400/5 p-3">
              <video
                src={videoUrl}
                autoPlay
                loop
                muted
                playsInline
                className="w-full rounded"
              />
              <a
                href={videoUrl}
                download={`${slug(rideTitle)}-highlight.webm`}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600"
              >
                <Download className="h-3.5 w-3.5" />
                Download .webm
              </a>
            </div>
          )}

          {fallbackPng && (
            <div className="flex flex-col gap-2 rounded-lg border border-amber-400/40 bg-amber-400/5 p-3 text-xs">
              <p className="text-amber-200">
                Animated capture isn&apos;t supported on this browser — saved a
                still snapshot instead.
              </p>
              <a
                href={fallbackPng}
                download={`${slug(rideTitle)}-highlight.png`}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600"
              >
                <Download className="h-3.5 w-3.5" />
                Download PNG
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Canvas helpers ──────────────────────────────────────────────────────────

interface DrawMeta {
  rideTitle: string;
  riderName: string;
  distanceKm: number;
  movingMinutes: number;
  maxSpeedKmh: number;
}

function drawFrame(
  canvas: HTMLCanvasElement,
  projected: { x: number; y: number }[],
  t: number,
  meta: DrawMeta
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Background — radial gradient evoking the night-mode map
  const grad = ctx.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, W);
  grad.addColorStop(0, "#0f172a");
  grad.addColorStop(1, "#020617");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Subtle grid for visual texture
  ctx.strokeStyle = "rgba(148, 163, 184, 0.08)";
  ctx.lineWidth = 1;
  for (let i = 80; i < W; i += 80) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, H);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(W, i);
    ctx.stroke();
  }

  if (projected.length < 2) return;

  // Compute the index up to which the polyline is "drawn"
  const drawnIdx = Math.max(1, Math.floor(projected.length * t));

  // Glow under the route
  ctx.shadowColor = "rgba(74, 222, 128, 0.85)";
  ctx.shadowBlur = 24;
  ctx.strokeStyle = "#22c55e";
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(projected[0].x, projected[0].y);
  for (let i = 1; i < drawnIdx; i++) {
    ctx.lineTo(projected[i].x, projected[i].y);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Start pin
  ctx.fillStyle = "#10b981";
  ctx.beginPath();
  ctx.arc(projected[0].x, projected[0].y, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.arc(projected[0].x, projected[0].y, 5, 0, Math.PI * 2);
  ctx.fill();

  // Moving head — pulse marker
  const head = projected[Math.min(drawnIdx - 1, projected.length - 1)];
  const pulse = 12 + Math.sin(t * Math.PI * 6) * 3;
  ctx.fillStyle = "rgba(250, 204, 21, 0.35)";
  ctx.beginPath();
  ctx.arc(head.x, head.y, pulse + 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#facc15";
  ctx.beginPath();
  ctx.arc(head.x, head.y, pulse, 0, Math.PI * 2);
  ctx.fill();

  // Finish pin (only when route is fully drawn)
  if (t >= 0.999) {
    const last = projected[projected.length - 1];
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(last.x, last.y, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "white";
    ctx.fillRect(last.x - 5, last.y - 9, 10, 18);
  }

  // ── Bottom panel — title + stats ──
  const panelH = 230;
  const panelTop = H - panelH;
  const panelGrad = ctx.createLinearGradient(0, panelTop, 0, H);
  panelGrad.addColorStop(0, "rgba(0,0,0,0)");
  panelGrad.addColorStop(0.4, "rgba(0,0,0,0.85)");
  panelGrad.addColorStop(1, "rgba(0,0,0,0.95)");
  ctx.fillStyle = panelGrad;
  ctx.fillRect(0, panelTop, W, panelH);

  ctx.textAlign = "left";
  ctx.fillStyle = "white";
  ctx.font = '700 44px "Inter", sans-serif';
  ctx.fillText(truncate(ctx, meta.rideTitle, W - 80), 40, H - 130);

  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = '500 26px "Inter", sans-serif';
  ctx.fillText(`by ${meta.riderName}`, 40, H - 88);

  // Stat row
  ctx.textAlign = "left";
  const statY = H - 38;
  drawStat(ctx, 40, statY, `${meta.distanceKm.toFixed(1)} km`, "Distance");
  drawStat(ctx, 380, statY, formatDuration(meta.movingMinutes), "Moving");
  drawStat(ctx, 700, statY, `${meta.maxSpeedKmh.toFixed(0)} km/h`, "Top speed");

  // Wordmark top-right
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = '400 28px "Courgette", "Inter", cursive';
  ctx.fillText("Tales on 2 Wheels", W - 30, 50);
}

function drawStat(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  value: string,
  label: string
) {
  ctx.font = '700 38px "Inter", sans-serif';
  ctx.fillStyle = "#facc15";
  ctx.fillText(value, x, y);
  ctx.font = '500 18px "Inter", sans-serif';
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillText(label.toUpperCase(), x, y + 22);
}

function truncate(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out.length > 4 && ctx.measureText(out + "…").width > maxWidth) {
    out = out.slice(0, -1);
  }
  return out + "…";
}

function useProjected(path: TrackPoint[]): { x: number; y: number }[] {
  // Project once per path change. Pad so the route doesn't kiss the edges.
  if (path.length === 0) return [];
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const p of path) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }
  const padX = 100;
  const padTop = 80;
  const padBottom = 260; // leave room for the stats panel
  const drawW = W - padX * 2;
  const drawH = H - padTop - padBottom;
  const latSpan = Math.max(0.0001, maxLat - minLat);
  const lngSpan = Math.max(0.0001, maxLng - minLng);
  // Maintain aspect — pick the scale that fits both axes inside the box.
  const scale = Math.min(drawW / lngSpan, drawH / latSpan);
  const renderedW = lngSpan * scale;
  const renderedH = latSpan * scale;
  const offsetX = padX + (drawW - renderedW) / 2;
  const offsetY = padTop + (drawH - renderedH) / 2;
  return path.map((p) => ({
    x: offsetX + (p.lng - minLng) * scale,
    // Lat increases northward; flip Y to put north at top of canvas.
    y: offsetY + (maxLat - p.lat) * scale,
  }));
}

function pickMime(): string | undefined {
  const candidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
    "video/mp4",
  ];
  for (const m of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) {
      return m;
    }
  }
  return undefined;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h${m}m` : `${h}h`;
}

function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50) || "ride"
  );
}
