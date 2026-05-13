"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Film, Loader2, Play, Download, RefreshCw, AlertTriangle } from "lucide-react";

interface VideoExport {
  id: string;
  status: "queued" | "rendering" | "ready" | "failed";
  videoUrl: string | null;
  thumbnailUrl: string | null;
  durationSec: number | null;
  fileSizeBytes: number | null;
  error: string | null;
  createdAt: string;
}

interface Props {
  rideId: string;
}

const POLL_INTERVAL_MS = 5000;

export function ReliveCard({ rideId }: Props) {
  const [latest, setLatest] = useState<VideoExport | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/rides/${rideId}/video/exports`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load exports");
      const body = (await res.json()) as { exports: VideoExport[] };
      setLatest(body.exports[0] || null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not check status");
    } finally {
      setLoading(false);
    }
  }, [rideId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Poll while a render is in flight. Stops automatically once the row
  // resolves to "ready" or "failed", or the user leaves the page.
  useEffect(() => {
    const inFlight = latest?.status === "queued" || latest?.status === "rendering";
    if (!inFlight) return;
    pollRef.current = window.setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current != null) window.clearInterval(pollRef.current);
    };
  }, [latest?.status, refresh]);

  const handleCreate = useCallback(async () => {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(`/api/rides/${rideId}/video/exports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ orientation: "landscape", resolution: "1080p" }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "Could not queue render");
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not queue render");
    } finally {
      setCreating(false);
    }
  }, [rideId, refresh]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Film className="h-4 w-4 text-t2w-accent" />
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Relive your ride
          </h3>
        </div>
        <Link
          href={`/ride/${rideId}/relive`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-t2w-accent/10 px-3 py-1.5 text-xs font-medium text-t2w-accent hover:bg-t2w-accent/20 transition-colors"
        >
          <Play className="h-3.5 w-3.5" />
          Watch flyover
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Checking for past renders…
        </div>
      ) : (
        <ReliveCardBody
          rideId={rideId}
          latest={latest}
          creating={creating}
          error={error}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
}

function ReliveCardBody({
  rideId,
  latest,
  creating,
  error,
  onCreate,
}: {
  rideId: string;
  latest: VideoExport | null;
  creating: boolean;
  error: string | null;
  onCreate: () => void;
}) {
  if (!latest) {
    return (
      <div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Generate a 60-second 3D flyover of the ride. We&rsquo;ll render it in
          the cloud and ping you when it&rsquo;s ready.
        </p>
        {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
        <button
          type="button"
          onClick={onCreate}
          disabled={creating}
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-t2w-accent px-3 py-2 text-xs font-medium text-black hover:bg-t2w-accent/90 disabled:opacity-60"
        >
          {creating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Film className="h-3.5 w-3.5" />
          )}
          Create Relive video
        </button>
      </div>
    );
  }

  if (latest.status === "queued" || latest.status === "rendering") {
    return (
      <div className="flex items-center gap-3">
        <Loader2 className="h-4 w-4 animate-spin text-t2w-accent" />
        <div>
          <p className="text-sm font-medium text-gray-800 dark:text-white">
            {latest.status === "queued" ? "Queued for rendering" : "Rendering now…"}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Usually finishes in 2–5 minutes. You can leave this page.
          </p>
        </div>
      </div>
    );
  }

  if (latest.status === "failed") {
    return (
      <div>
        <div className="flex items-center gap-2 text-sm text-red-500">
          <AlertTriangle className="h-4 w-4" />
          Render failed
        </div>
        {latest.error && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{latest.error}</p>
        )}
        <button
          type="button"
          onClick={onCreate}
          disabled={creating}
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-xs font-medium text-gray-700 dark:text-white hover:bg-white/20 disabled:opacity-60"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Try again
        </button>
      </div>
    );
  }

  // status === "ready"
  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3">
        {latest.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={latest.thumbnailUrl}
            alt="Relive thumbnail"
            className="aspect-video w-full sm:w-48 rounded-lg object-cover"
          />
        ) : (
          <div className="aspect-video w-full sm:w-48 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
            <Film className="h-8 w-8 text-gray-400" />
          </div>
        )}
        <div className="flex-1 flex flex-col justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-gray-800 dark:text-white">
              Your video is ready
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {latest.durationSec ? `${latest.durationSec}s · ` : ""}
              {latest.fileSizeBytes
                ? `${(latest.fileSizeBytes / 1024 / 1024).toFixed(1)} MB`
                : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/ride/${rideId}/relive`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-t2w-accent px-3 py-1.5 text-xs font-medium text-black hover:bg-t2w-accent/90"
            >
              <Play className="h-3.5 w-3.5" />
              Watch
            </Link>
            {latest.videoUrl && (
              <a
                href={latest.videoUrl}
                download
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-white hover:bg-white/20"
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </a>
            )}
            <button
              type="button"
              onClick={onCreate}
              disabled={creating}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-white hover:bg-white/20 disabled:opacity-60"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Re-render
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
