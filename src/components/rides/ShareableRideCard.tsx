"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Share2, Upload, X, Check, ImagePlus } from "lucide-react";
import type { LiveRideMetrics, RideAnalytics } from "@/types";

// 9:16 Story format — works on Instagram Stories, WhatsApp Status, FB Stories,
// and renders fine when shared into a 1:1 chat as well.
const CANVAS_W = 1080;
const CANVAS_H = 1920;
const STAT_CAP = 4;
const STORAGE_KEY = "t2w:shareCardStats";

export type ShareStatKey =
  | "distance"
  | "duration"
  | "movingTime"
  | "avgSpeed"
  | "maxSpeed"
  | "elevation"
  | "elevationLoss"
  | "highestPoint"
  | "longestClimb"
  | "steepestGrade"
  | "stops"
  | "startTime"
  | "endTime"
  | "riders";

interface ResolveCtx {
  metrics: LiveRideMetrics;
  analytics: RideAnalytics | null;
}

interface StatOption {
  key: ShareStatKey;
  label: string;
  /** Returns the formatted value string, or null if the metric isn't available */
  resolve: (ctx: ResolveCtx) => string | null;
}

const STAT_OPTIONS: StatOption[] = [
  {
    key: "distance",
    label: "Distance",
    resolve: ({ metrics: m }) => (m.distanceKm > 0 ? `${m.distanceKm} km` : null),
  },
  {
    key: "movingTime",
    label: "Moving Time",
    resolve: ({ metrics: m }) => (m.movingMinutes > 0 ? formatDuration(m.movingMinutes) : null),
  },
  {
    key: "duration",
    label: "Duration",
    resolve: ({ metrics: m }) => (m.elapsedMinutes > 0 ? formatDuration(m.elapsedMinutes) : null),
  },
  {
    key: "avgSpeed",
    label: "Avg Speed",
    resolve: ({ metrics: m }) => (m.avgSpeedKmh > 0 ? `${m.avgSpeedKmh} km/h` : null),
  },
  {
    key: "maxSpeed",
    label: "Max Speed",
    resolve: ({ metrics: m }) => (m.maxSpeedKmh > 0 ? `${m.maxSpeedKmh} km/h` : null),
  },
  {
    key: "elevation",
    label: "Elevation Gain",
    resolve: ({ metrics: m }) => (m.elevationGainM != null ? `${m.elevationGainM} m` : null),
  },
  {
    key: "elevationLoss",
    label: "Elevation Loss",
    resolve: ({ metrics: m }) => (m.elevationLossM != null ? `${m.elevationLossM} m` : null),
  },
  {
    key: "highestPoint",
    label: "Highest Point",
    resolve: ({ metrics: m }) =>
      m.elevation?.maxM != null ? `${m.elevation.maxM} m` : null,
  },
  {
    key: "longestClimb",
    label: "Longest Climb",
    resolve: ({ analytics }) =>
      analytics?.climb.longest
        ? `${analytics.climb.longest.distanceKm.toFixed(1)} km`
        : null,
  },
  {
    key: "steepestGrade",
    label: "Steepest Grade",
    resolve: ({ analytics }) =>
      analytics?.climb.steepest
        ? `${analytics.climb.steepest.gradePct.toFixed(1)}%`
        : null,
  },
  {
    key: "stops",
    label: "Stops",
    resolve: ({ metrics: m }) => (m.breakCount > 0 ? `${m.breakCount}` : null),
  },
  {
    key: "startTime",
    label: "Start",
    resolve: ({ metrics: m }) => (m.startedAt ? formatTime(m.startedAt) : null),
  },
  {
    key: "endTime",
    label: "End",
    resolve: ({ metrics: m }) => (m.endedAt ? formatTime(m.endedAt) : null),
  },
  {
    key: "riders",
    label: "Riders",
    resolve: ({ metrics: m }) => (m.riderCount > 0 ? `${m.riderCount}` : null),
  },
];

interface ShareableRideCardProps {
  rideTitle: string;
  riderName: string;
  metrics: LiveRideMetrics;
  analytics?: RideAnalytics | null;
  onClose: () => void;
}

export function ShareableRideCard({
  rideTitle,
  riderName,
  metrics,
  analytics = null,
  onClose,
}: ShareableRideCardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const photoRef = useRef<HTMLImageElement | null>(null);
  const logoRef = useRef<HTMLImageElement | null>(null);
  const [photoLoaded, setPhotoLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [downloadedAt, setDownloadedAt] = useState<number | null>(null);

  // Available stat options (filtered to those that have data)
  const resolveCtx = useMemo<ResolveCtx>(
    () => ({ metrics, analytics }),
    [metrics, analytics]
  );
  const availableStats = useMemo(
    () => STAT_OPTIONS.filter((o) => o.resolve(resolveCtx) != null),
    [resolveCtx]
  );

  // One-line "headline" stat the card draws above the rider name — picked
  // automatically from the strongest signal in the ride. Riders can opt in
  // by leaving the headline default, or hide it with the toggle below.
  const headline = useMemo(
    () => pickHeadline(metrics, analytics),
    [metrics, analytics]
  );
  const [showHeadline, setShowHeadline] = useState(true);

  // Selected stat keys — restored from localStorage, capped + filtered to
  // currently-available options.
  const [selected, setSelected] = useState<ShareStatKey[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as ShareStatKey[];
      const filtered = stored
        .filter((k) => STAT_OPTIONS.find((o) => o.key === k))
        .slice(0, STAT_CAP);
      if (filtered.length > 0) return filtered;
    } catch {
      // ignore
    }
    return ["distance", "movingTime", "avgSpeed", "maxSpeed"].filter((k) =>
      STAT_OPTIONS.find((o) => o.key === k && o.resolve(resolveCtx) != null)
    ) as ShareStatKey[];
  });

  // Persist selection
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(selected));
    } catch {
      // localStorage may be disabled (private browsing); ignore
    }
  }, [selected]);

  // Drop selected keys whose data has disappeared (e.g. elevation null)
  useEffect(() => {
    const validKeys = new Set(availableStats.map((o) => o.key));
    setSelected((prev) => prev.filter((k) => validKeys.has(k)));
  }, [availableStats]);

  // Preload logo + fonts once on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Belt-and-braces: wait for the document fonts to resolve before
      // explicitly loading the weights we draw, so canvas doesn't fall back
      // to system sans on first render.
      try {
        await document.fonts.ready;
        await Promise.all([
          document.fonts.load("700 56px Inter"),
          document.fonts.load("500 32px Inter"),
          document.fonts.load("400 22px Inter"),
          document.fonts.load("400 36px Courgette"),
          document.fonts.load("400 56px Courgette"),
        ]);
      } catch {
        // Fonts API failure is non-fatal; canvas falls back to system fonts.
      }

      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        if (!cancelled) {
          logoRef.current = img;
          // Force re-render in case a photo is already loaded and waiting.
          setPhotoLoaded((p) => p);
        }
      };
      img.src = "/logo.png";
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Re-render canvas whenever inputs change
  useEffect(() => {
    if (!canvasRef.current) return;
    renderCard({
      canvas: canvasRef.current,
      photo: photoRef.current,
      logo: logoRef.current,
      rideTitle,
      riderName,
      headline: showHeadline ? headline : null,
      stats: selected.map((k) => {
        const opt = STAT_OPTIONS.find((o) => o.key === k)!;
        return { label: opt.label, value: opt.resolve(resolveCtx) ?? "—" };
      }),
    });
  }, [
    rideTitle,
    riderName,
    selected,
    resolveCtx,
    photoLoaded,
    headline,
    showHeadline,
  ]);

  // Photo upload handler
  function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      photoRef.current = img;
      setPhotoLoaded(true);
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  function toggleStat(key: ShareStatKey) {
    setSelected((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key);
      if (prev.length >= STAT_CAP) return prev;
      return [...prev, key];
    });
  }

  async function downloadPNG() {
    if (!canvasRef.current || busy) return;
    setBusy(true);
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvasRef.current!.toBlob(resolve, "image/png")
      );
      if (!blob) return;
      const filename = `${slug(rideTitle)}-t2w.png`;

      // Prefer the native share sheet on mobile so the file goes straight
      // into WhatsApp / Instagram. Desktop browsers fall back to download.
      const file = new File([blob], filename, { type: "image/png" });
      const nav = navigator as Navigator & {
        canShare?: (data: { files: File[] }) => boolean;
      };
      if (nav.canShare?.({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: rideTitle,
            text: "My Tales on 2 Wheels ride",
          });
          setDownloadedAt(Date.now());
          return;
        } catch {
          // User dismissed share sheet — fall through to download.
        }
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setDownloadedAt(Date.now());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900 sm:flex-row">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 rounded-full bg-black/40 p-1.5 text-white hover:bg-black/60"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Preview */}
        <div className="flex flex-1 items-center justify-center bg-gray-950 p-4">
          <div className="relative w-full max-w-[280px] sm:max-w-[320px]">
            <canvas
              ref={canvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              data-testid="share-card-canvas"
              className="h-auto w-full rounded-lg shadow-2xl"
              style={{ aspectRatio: `${CANVAS_W}/${CANVAS_H}` }}
            />
            {!photoLoaded && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-gray-900/60 text-center text-sm text-gray-300">
                <div className="px-6">
                  <ImagePlus className="mx-auto mb-2 h-8 w-8 opacity-60" />
                  Upload a photo to see the preview
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex w-full flex-col gap-4 overflow-y-auto border-t border-gray-200 p-5 dark:border-gray-800 sm:w-[340px] sm:border-l sm:border-t-0">
          <div>
            <h3 className="text-base font-bold dark:text-white">Shareable card</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Upload a photo, pick up to {STAT_CAP} stats, then download or share.
            </p>
          </div>

          {headline && (
            <label className="flex items-start gap-2 rounded-lg border border-t2w-accent/40 bg-t2w-accent/5 p-2.5 text-xs text-gray-700 dark:text-gray-200">
              <input
                type="checkbox"
                checked={showHeadline}
                onChange={(e) => setShowHeadline(e.target.checked)}
                data-testid="share-card-headline-toggle"
                className="mt-0.5 h-3.5 w-3.5 rounded border-gray-300 text-t2w-accent focus:ring-t2w-accent"
              />
              <span>
                <span className="font-semibold text-t2w-accent">Auto headline:</span>{" "}
                {headline}
              </span>
            </label>
          )}

          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700">
            <Upload className="h-4 w-4" />
            <span>{photoLoaded ? "Replace photo" : "Choose photo"}</span>
            <input
              type="file"
              accept="image/*"
              onChange={onPickPhoto}
              data-testid="share-card-upload"
              className="hidden"
            />
          </label>

          <div>
            <div className="mb-2 flex items-center justify-between text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              <span>Pick stats</span>
              <span>
                {selected.length}/{STAT_CAP}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {availableStats.map((opt) => {
                const isSelected = selected.includes(opt.key);
                const limitReached =
                  !isSelected && selected.length >= STAT_CAP;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => toggleStat(opt.key)}
                    disabled={limitReached}
                    data-testid={`share-card-stat-${opt.key}`}
                    className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${
                      isSelected
                        ? "border-t2w-accent bg-t2w-accent/10 text-t2w-accent"
                        : limitReached
                          ? "border-gray-200 bg-gray-50 text-gray-400 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-600 cursor-not-allowed"
                          : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                    }`}
                  >
                    {isSelected && <Check className="h-3 w-3" />}
                    <span className="truncate">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-auto space-y-2">
            <button
              type="button"
              onClick={downloadPNG}
              disabled={!photoLoaded || selected.length === 0 || busy}
              data-testid="share-card-download"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-t2w-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-t2w-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {typeof navigator !== "undefined" &&
              "canShare" in navigator ? (
                <Share2 className="h-4 w-4" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {busy ? "Preparing…" : downloadedAt ? "Done — share away!" : "Download / Share"}
            </button>
            <p className="text-center text-[11px] text-gray-500 dark:text-gray-400">
              Saved as PNG. Ride photo never leaves your device.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Canvas rendering ────────────────────────────────────────────────────────

interface RenderArgs {
  canvas: HTMLCanvasElement;
  photo: HTMLImageElement | null;
  logo: HTMLImageElement | null;
  rideTitle: string;
  riderName: string;
  headline: string | null;
  stats: { label: string; value: string }[];
}

function renderCard({
  canvas,
  photo,
  logo,
  rideTitle,
  riderName,
  headline,
  stats,
}: RenderArgs) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  // ── Background photo (cover-fit) ────────────────────────────────────────
  if (photo) {
    const scale = Math.max(CANVAS_W / photo.width, CANVAS_H / photo.height);
    const dw = photo.width * scale;
    const dh = photo.height * scale;
    const dx = (CANVAS_W - dw) / 2;
    const dy = (CANVAS_H - dh) / 2;
    ctx.drawImage(photo, dx, dy, dw, dh);
  } else {
    // Charcoal fallback so text is still readable in the empty preview.
    const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    grad.addColorStop(0, "#1f2937");
    grad.addColorStop(1, "#111827");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  // ── Top scrim — keeps the wordmark legible on bright photos ─────────────
  const topGrad = ctx.createLinearGradient(0, 0, 0, 240);
  topGrad.addColorStop(0, "rgba(0,0,0,0.55)");
  topGrad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, CANVAS_W, 240);

  // ── Bottom scrim — keeps the stats grid + branding readable ─────────────
  const bottomGrad = ctx.createLinearGradient(0, 880, 0, CANVAS_H);
  bottomGrad.addColorStop(0, "rgba(0,0,0,0)");
  bottomGrad.addColorStop(0.35, "rgba(0,0,0,0.55)");
  bottomGrad.addColorStop(1, "rgba(0,0,0,0.92)");
  ctx.fillStyle = bottomGrad;
  ctx.fillRect(0, 880, CANVAS_W, CANVAS_H - 880);

  // ── Top-left wordmark + logo ────────────────────────────────────────────
  if (logo) {
    ctx.drawImage(logo, 60, 60, 80, 80);
  }
  ctx.fillStyle = "#ffffff";
  ctx.font = '400 36px "Courgette", cursive';
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("Tales on 2 Wheels", logo ? 160 : 60, 100);

  // ── Headline banner — automatic "best stat" call-out above the title ────
  if (headline) {
    ctx.font = '600 28px "Inter", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    const padding = 40;
    const text = headline;
    const metricsBox = ctx.measureText(text);
    const boxW = Math.min(CANVAS_W - 120, metricsBox.width + padding * 2);
    const boxH = 60;
    const boxX = (CANVAS_W - boxW) / 2;
    const boxY = 1030;
    ctx.fillStyle = "rgba(34, 197, 94, 0.85)";
    roundRect(ctx, boxX, boxY, boxW, boxH, 30);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = '600 26px "Inter", sans-serif';
    ctx.textBaseline = "middle";
    ctx.fillText(text, CANVAS_W / 2, boxY + boxH / 2 + 1);
    ctx.textBaseline = "alphabetic";
  }

  // ── Ride title (Courgette, centered) ────────────────────────────────────
  ctx.fillStyle = "#ffffff";
  ctx.font = '400 56px "Courgette", cursive';
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(truncate(ctx, rideTitle, CANVAS_W - 120), CANVAS_W / 2, 1140);

  // ── Rider name ──────────────────────────────────────────────────────────
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = '500 32px "Inter", sans-serif';
  ctx.fillText(`by ${riderName}`, CANVAS_W / 2, 1200);

  // ── Stats grid (2×2 by default; gracefully reflows for 1-3 picks) ───────
  drawStatsGrid(ctx, stats);

  // ── Bottom URL ──────────────────────────────────────────────────────────
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.font = '400 26px "Inter", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText("taleson2wheels.com", CANVAS_W / 2, 1860);
}

function drawStatsGrid(
  ctx: CanvasRenderingContext2D,
  stats: { label: string; value: string }[]
) {
  if (stats.length === 0) return;

  // Layout: 2-col grid for 2 or 4 stats, single row for 1, 3-up for 3.
  const cols = stats.length === 1 ? 1 : stats.length === 3 ? 3 : 2;
  const rows = Math.ceil(stats.length / cols);
  const gap = 32;
  const sideMargin = 80;
  const tileW = (CANVAS_W - sideMargin * 2 - gap * (cols - 1)) / cols;
  const tileH = 200;
  const gridH = rows * tileH + (rows - 1) * gap;
  const gridTop = 1280; // below the rider name

  for (let i = 0; i < stats.length; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const x = sideMargin + c * (tileW + gap);
    const y = gridTop + r * (tileH + gap);
    drawStatTile(ctx, x, y, tileW, tileH, stats[i].value, stats[i].label);
  }

  // Defensively avoid drawing beyond the brand-line area
  void gridH;
}

function drawStatTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  value: string,
  label: string
) {
  const radius = 24;
  // Glassmorphism tile
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  roundRect(ctx, x, y, w, h, radius);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 1.5;
  roundRect(ctx, x, y, w, h, radius);
  ctx.stroke();

  // Value
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = '700 64px "Inter", sans-serif';
  const valueText = autoFit(ctx, value, w - 32, 64);
  ctx.fillText(valueText.text, x + w / 2, y + h / 2 - 12);

  // Label
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = '500 24px "Inter", sans-serif';
  ctx.fillText(label.toUpperCase(), x + w / 2, y + h / 2 + 50);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function autoFit(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxFontPx: number
): { text: string; fontPx: number } {
  let fontPx = maxFontPx;
  while (fontPx > 24) {
    ctx.font = `700 ${fontPx}px "Inter", sans-serif`;
    if (ctx.measureText(text).width <= maxWidth) {
      return { text, fontPx };
    }
    fontPx -= 4;
  }
  return { text, fontPx };
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

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50) || "ride";
}

/**
 * Pick the most impressive single stat from the ride and phrase it as a
 * one-liner. The order is intentional — distance + max speed land first
 * because they're universally legible; climb / cohesion only beat them
 * when they're genuinely interesting (long climb, tight group).
 *
 * Returns null when nothing crosses the "worth bragging about" thresholds.
 */
function pickHeadline(
  metrics: LiveRideMetrics,
  analytics: RideAnalytics | null
): string | null {
  if (metrics.distanceKm >= 500) {
    return `Epic ride — ${metrics.distanceKm} km in the saddle`;
  }
  if (metrics.maxSpeedKmh >= 120) {
    return `Topped ${Math.round(metrics.maxSpeedKmh)} km/h`;
  }
  if (analytics?.climb.longest && analytics.climb.longest.gainM >= 500) {
    return `Climbed ${analytics.climb.longest.gainM} m in one go`;
  }
  if (analytics?.climb.steepest && analytics.climb.steepest.gradePct >= 8) {
    return `Tackled a ${analytics.climb.steepest.gradePct.toFixed(1)}% gradient`;
  }
  if (metrics.elevationGainM != null && metrics.elevationGainM >= 1500) {
    return `${metrics.elevationGainM} m of total ascent`;
  }
  if (analytics?.cohesion && analytics.cohesion.togetherPct >= 80 && analytics.cohesion.riderCount >= 4) {
    return `Group stayed tight — ${analytics.cohesion.togetherPct}% together`;
  }
  if (metrics.distanceKm >= 200) {
    return `${metrics.distanceKm} km on two wheels`;
  }
  if (metrics.distanceKm >= 100) {
    return `Crossed the century mark — ${metrics.distanceKm} km`;
  }
  return null;
}
