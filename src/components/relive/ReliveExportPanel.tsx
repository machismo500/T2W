"use client";

import { useCallback, useState } from "react";
import { Cloud, Download, Loader2, X } from "lucide-react";

interface Props {
  rideId: string;
  orientation: "landscape" | "portrait";
  durationSec: number;
  /**
   * Returns the live <canvas> element being rendered by Mapbox so we can
   * capture its stream. Returns null if the map hasn't finished mounting yet.
   */
  getCanvas: () => HTMLCanvasElement | null;
  onClose: () => void;
}

type LocalState = "idle" | "recording" | "encoding" | "done" | "error";
type ServerState = "idle" | "submitting" | "queued" | "error";

export function ReliveExportPanel({
  rideId,
  orientation,
  durationSec,
  getCanvas,
  onClose,
}: Props) {
  const [localState, setLocalState] = useState<LocalState>("idle");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const [serverState, setServerState] = useState<ServerState>("idle");
  const [serverError, setServerError] = useState<string | null>(null);

  const handleLocalRecord = useCallback(async () => {
    const canvas = getCanvas();
    if (!canvas) {
      setLocalError("Map isn't ready yet — try again in a moment.");
      setLocalState("error");
      return;
    }
    if (typeof window.MediaRecorder !== "function") {
      setLocalError("Your browser doesn't support in-browser video capture.");
      setLocalState("error");
      return;
    }

    setLocalError(null);
    setDownloadUrl(null);
    setLocalState("recording");

    try {
      const stream = canvas.captureStream(30);
      // Prefer MP4 when supported (Safari 17+), fall back to WebM.
      const mimePrefs = [
        "video/mp4;codecs=avc1",
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
      ];
      const mime = mimePrefs.find((m) =>
        typeof MediaRecorder.isTypeSupported === "function"
          ? MediaRecorder.isTypeSupported(m)
          : false
      );
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      const stopped = new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
      });
      recorder.start();
      // Stop ~200ms after the configured duration so the outro card lands in
      // the recording instead of being clipped at the wrap.
      window.setTimeout(() => {
        if (recorder.state !== "inactive") recorder.stop();
      }, durationSec * 1000 + 200);
      await stopped;
      setLocalState("encoding");
      const out = new Blob(chunks, { type: chunks[0]?.type || "video/webm" });
      const url = URL.createObjectURL(out);
      setDownloadUrl(url);
      setLocalState("done");
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Recording failed");
      setLocalState("error");
    }
  }, [getCanvas, durationSec]);

  const handleServerRender = useCallback(async () => {
    setServerError(null);
    setServerState("submitting");
    try {
      const res = await fetch(`/api/rides/${rideId}/video/exports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ orientation, resolution: "1080p" }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `Request failed (${res.status})`);
      }
      setServerState("queued");
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Could not queue render");
      setServerState("error");
    }
  }, [rideId, orientation]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-lg rounded-2xl bg-t2w-surface p-6 text-white shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full p-1 text-t2w-muted hover:bg-white/10 hover:text-white"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        <h2 className="font-display text-xl font-bold">Download your Relive</h2>
        <p className="mt-1 text-xs text-t2w-muted">
          Pick the studio render for the share-worthy version, or grab a quick
          local capture right now.
        </p>

        <section className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-start gap-3">
            <Cloud className="h-5 w-5 shrink-0 text-t2w-accent" />
            <div className="flex-1">
              <p className="text-sm font-semibold">Studio quality (recommended)</p>
              <p className="mt-1 text-xs text-t2w-muted">
                Renders a clean 1080p MP4 in the cloud. Takes a few minutes; you&rsquo;ll
                see it in the &quot;Relive your ride&quot; card on the ride summary
                when it&rsquo;s ready.
              </p>
              {serverState === "queued" && (
                <p className="mt-2 text-xs font-medium text-t2w-accent">
                  Queued. We&rsquo;ll notify you when it&rsquo;s ready.
                </p>
              )}
              {serverState === "error" && serverError && (
                <p className="mt-2 text-xs text-red-400">{serverError}</p>
              )}
              <button
                type="button"
                onClick={handleServerRender}
                disabled={serverState === "submitting" || serverState === "queued"}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-t2w-accent px-3 py-2 text-xs font-medium text-black hover:bg-t2w-accent/90 disabled:opacity-60"
              >
                {serverState === "submitting" && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                )}
                {serverState === "queued"
                  ? "Queued"
                  : serverState === "submitting"
                    ? "Queuing…"
                    : "Render in the cloud"}
              </button>
            </div>
          </div>
        </section>

        <section className="mt-3 rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-start gap-3">
            <Download className="h-5 w-5 shrink-0 text-white/80" />
            <div className="flex-1">
              <p className="text-sm font-semibold">Save it locally now</p>
              <p className="mt-1 text-xs text-t2w-muted">
                Captures the flyover from this browser tab. Quality varies by
                device and the tab needs to stay open until it finishes.
              </p>
              {localState === "recording" && (
                <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-t2w-muted">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Recording {durationSec}s — keep this tab in front
                </p>
              )}
              {localState === "encoding" && (
                <p className="mt-2 text-xs text-t2w-muted">Encoding…</p>
              )}
              {localState === "error" && localError && (
                <p className="mt-2 text-xs text-red-400">{localError}</p>
              )}
              {localState === "done" && downloadUrl && (
                <a
                  href={downloadUrl}
                  download={`relive-${rideId}.webm`}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-white/15 px-3 py-2 text-xs font-medium text-white hover:bg-white/25"
                >
                  <Download className="h-3.5 w-3.5" />
                  Save video
                </a>
              )}
              {localState === "idle" || localState === "error" ? (
                <button
                  type="button"
                  onClick={handleLocalRecord}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-white/15 px-3 py-2 text-xs font-medium text-white hover:bg-white/25"
                >
                  Capture now
                </button>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
