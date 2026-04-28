"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Shield, Loader2, Play, Square, RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

/**
 * Superadmin-only runner for the base64 → Vercel Blob migration.
 *
 * Replaces the local CLI flow (`npm run migrate:images-to-blob`) for users
 * who can't run the script locally. Polls /api/admin/migrate-images in a
 * loop while the "Run continuously" toggle is on, processing N rows per
 * call (default 10) and stopping when counts hit zero.
 */

interface Counts {
  user: number;
  riderProfile: number;
  motorcycle: number;
  ride: number;
  blogPost: number;
  ridePost: number;
}

interface BatchEntry {
  table: string;
  id: string;
  url: string;
}

interface FailedEntry {
  table: string;
  id: string;
  error: string;
}

interface BatchResponse {
  batch: number;
  elapsedMs: number;
  migrated: BatchEntry[];
  failed: FailedEntry[];
  counts: Counts;
  total: number;
  done: boolean;
}

interface StatusResponse {
  counts: Counts;
  total: number;
  blobReady: boolean;
  blobAccess: "public" | "private";
  done: boolean;
}

const COLUMN_LABELS: { key: keyof Counts; label: string }[] = [
  { key: "user", label: "User.avatar" },
  { key: "riderProfile", label: "RiderProfile.avatarUrl" },
  { key: "motorcycle", label: "Motorcycle.imageUrl" },
  { key: "ride", label: "Ride.posterUrl" },
  { key: "blogPost", label: "BlogPost.coverImage" },
  { key: "ridePost", label: "RidePost.images" },
];

const BATCH_SIZE = 10;
const MAX_LOG_ENTRIES = 200;

export function MigrateImagesPage() {
  const { user, loading: authLoading, isSuperAdmin } = useAuth();
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [continuous, setContinuous] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [migratedCount, setMigratedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [initialTotal, setInitialTotal] = useState<number | null>(null);
  // Ref so the running batch can read the latest "stop" intent without a
  // re-render race against itself.
  const continuousRef = useRef(false);

  const appendLog = useCallback((line: string) => {
    setLog((prev) => {
      const next = [`[${new Date().toLocaleTimeString()}] ${line}`, ...prev];
      return next.length > MAX_LOG_ENTRIES ? next.slice(0, MAX_LOG_ENTRIES) : next;
    });
  }, []);

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/migrate-images", { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data: StatusResponse = await res.json();
      setStatus(data);
      setStatusError(null);
      setInitialTotal((prev) => (prev === null ? data.total : prev));
      return data;
    } catch (err) {
      setStatusError((err as Error).message);
      return null;
    }
  }, []);

  useEffect(() => {
    if (isSuperAdmin) refreshStatus();
  }, [isSuperAdmin, refreshStatus]);

  const runBatch = useCallback(async (): Promise<BatchResponse | null> => {
    try {
      const res = await fetch("/api/admin/migrate-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batch: BATCH_SIZE }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      return (await res.json()) as BatchResponse;
    } catch (err) {
      appendLog(`✗ Batch error: ${(err as Error).message}`);
      return null;
    }
  }, [appendLog]);

  const runOnce = useCallback(async () => {
    if (running) return;
    setRunning(true);
    appendLog(`Running batch of ${BATCH_SIZE}…`);
    const result = await runBatch();
    if (result) {
      setMigratedCount((c) => c + result.migrated.length);
      setFailedCount((c) => c + result.failed.length);
      for (const m of result.migrated) appendLog(`✓ ${m.table} ${m.id}`);
      for (const f of result.failed) appendLog(`✗ ${f.table} ${f.id} — ${f.error}`);
      appendLog(
        `Batch done in ${result.elapsedMs} ms · remaining ${result.total}` +
          (result.done ? " · 🎉 ALL DONE" : "")
      );
      setStatus((prev) => ({
        counts: result.counts,
        total: result.total,
        blobReady: true,
        blobAccess: prev?.blobAccess ?? "public",
        done: result.done,
      }));
    }
    setRunning(false);
  }, [running, runBatch, appendLog]);

  const startContinuous = useCallback(async () => {
    if (running) return;
    continuousRef.current = true;
    setContinuous(true);
    setRunning(true);
    appendLog(`▶ Continuous run started (batches of ${BATCH_SIZE})`);

    while (continuousRef.current) {
      const result = await runBatch();
      if (!result) {
        appendLog("⏸ Stopping due to batch error.");
        break;
      }
      setMigratedCount((c) => c + result.migrated.length);
      setFailedCount((c) => c + result.failed.length);
      for (const m of result.migrated) appendLog(`✓ ${m.table} ${m.id}`);
      for (const f of result.failed) appendLog(`✗ ${f.table} ${f.id} — ${f.error}`);
      setStatus((prev) => ({
        counts: result.counts,
        total: result.total,
        blobReady: true,
        blobAccess: prev?.blobAccess ?? "public",
        done: result.done,
      }));
      if (result.done) {
        appendLog("🎉 All rows migrated.");
        break;
      }
      // Tiny breath to let React paint and avoid hammering the API.
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    continuousRef.current = false;
    setContinuous(false);
    setRunning(false);
  }, [running, runBatch, appendLog]);

  const stopContinuous = useCallback(() => {
    continuousRef.current = false;
    appendLog("⏸ Stop requested — finishing current batch…");
  }, [appendLog]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center pt-24">
        <Loader2 className="h-8 w-8 animate-spin text-t2w-muted" />
      </div>
    );
  }

  if (!user || !isSuperAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center pt-24">
        <div className="text-center">
          <Shield className="mx-auto h-16 w-16 text-t2w-border" />
          <h2 className="mt-4 font-display text-2xl font-bold text-white">Access Denied</h2>
          <p className="mt-2 text-t2w-muted">
            This page is restricted to Super Admins.
          </p>
          <Link href="/admin" className="btn-primary mt-6 inline-block">
            Back to Admin
          </Link>
        </div>
      </div>
    );
  }

  const total = status?.total ?? 0;
  const progress =
    initialTotal && initialTotal > 0
      ? Math.round(((initialTotal - total) / initialTotal) * 100)
      : total === 0
      ? 100
      : 0;

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-24">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-bold text-white">Migrate Images to Blob</h1>
        <p className="mt-1 text-sm text-t2w-muted">
          One-shot migration: base64 images stored in Postgres → Vercel Blob CDN URLs.
          Idempotent and safe to re-run.
        </p>
      </header>

      {!status?.blobReady && status !== null && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <div>
            <p className="font-semibold text-amber-200">BLOB_READ_WRITE_TOKEN missing</p>
            <p className="mt-1 text-amber-200/80">
              Connect the Blob store to this project in the Vercel dashboard
              (Storage → t2w-images → Connect Project), then redeploy.
            </p>
          </div>
        </div>
      )}

      {status?.blobReady && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-t2w-border bg-t2w-surface p-3 text-xs text-t2w-muted">
          <Shield className="mt-0.5 h-4 w-4 shrink-0 text-t2w-muted" />
          <div>
            Uploading with{" "}
            <code className="rounded bg-t2w-bg px-1.5 py-0.5 font-mono text-white">
              access: &quot;{status.blobAccess}&quot;
            </code>{" "}
            (set via <code>BLOB_ACCESS</code>). Must match the store&apos;s mode
            in the Vercel dashboard, otherwise every upload fails with{" "}
            <em>&quot;Cannot use {status.blobAccess} access on a{" "}
            {status.blobAccess === "public" ? "private" : "public"} store&quot;</em>.
            {status.blobAccess === "private" && (
              <>
                {" "}
                <strong className="text-amber-300">
                  Heads up: private blob URLs require a server proxy to render
                  in &lt;img&gt; tags.
                </strong>
              </>
            )}
          </div>
        </div>
      )}

      {statusError && (
        <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
          {statusError}
        </div>
      )}

      <section className="rounded-xl border border-t2w-border bg-t2w-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-white">Pending rows</h2>
          <button
            type="button"
            onClick={refreshStatus}
            disabled={running}
            className="flex items-center gap-1.5 text-xs text-t2w-muted hover:text-white disabled:opacity-50"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {COLUMN_LABELS.map(({ key, label }) => (
            <div
              key={key}
              className="rounded-lg border border-t2w-border bg-t2w-bg p-3"
            >
              <p className="text-xs text-t2w-muted">{label}</p>
              <p className="mt-1 font-display text-2xl font-bold text-white">
                {status?.counts[key] ?? "—"}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between rounded-lg border border-t2w-border bg-t2w-bg p-3">
          <span className="text-sm text-t2w-muted">Total remaining</span>
          <span className="font-display text-xl font-bold text-white">
            {status?.total ?? "—"}
          </span>
        </div>

        {initialTotal !== null && initialTotal > 0 && (
          <div className="mt-3">
            <div className="h-2 overflow-hidden rounded-full bg-t2w-bg">
              <div
                className="h-full bg-t2w-accent transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-1.5 text-right text-xs text-t2w-muted">
              {progress}% · {migratedCount} migrated · {failedCount} failed
            </p>
          </div>
        )}
      </section>

      <section className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={runOnce}
          disabled={running || !status?.blobReady || total === 0}
          className="btn-primary flex items-center gap-2 disabled:opacity-50"
        >
          {running && !continuous ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          Run one batch ({BATCH_SIZE})
        </button>

        {!continuous ? (
          <button
            type="button"
            onClick={startContinuous}
            disabled={running || !status?.blobReady || total === 0}
            className="btn-secondary flex items-center gap-2 disabled:opacity-50"
          >
            <Play className="h-4 w-4" />
            Run continuously until done
          </button>
        ) : (
          <button
            type="button"
            onClick={stopContinuous}
            className="flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200 hover:bg-red-500/20"
          >
            <Square className="h-4 w-4" /> Stop after current batch
          </button>
        )}

        {total === 0 && status !== null && (
          <span className="flex items-center gap-1.5 text-sm font-semibold text-emerald-400">
            <CheckCircle2 className="h-4 w-4" /> All migrated
          </span>
        )}
      </section>

      <section className="mt-6 rounded-xl border border-t2w-border bg-t2w-surface p-5">
        <h2 className="font-display text-lg font-bold text-white">Activity log</h2>
        <p className="mt-1 text-xs text-t2w-muted">
          Newest first. Last {MAX_LOG_ENTRIES} entries.
        </p>
        <div className="mt-3 max-h-96 overflow-y-auto rounded-lg border border-t2w-border bg-t2w-bg p-3 font-mono text-xs">
          {log.length === 0 ? (
            <p className="text-t2w-muted">No activity yet.</p>
          ) : (
            log.map((line, i) => (
              <div
                key={`${i}-${line.slice(0, 30)}`}
                className={
                  line.includes("✗")
                    ? "text-red-300"
                    : line.includes("✓") || line.includes("🎉")
                    ? "text-emerald-300"
                    : "text-t2w-muted"
                }
              >
                {line}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
