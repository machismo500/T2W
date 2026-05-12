"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api-client";
import { snapWaypointsToRoads, type DirectionsServiceLike } from "@/lib/route-snap";
import type { LiveRideSession, LiveRiderLocation } from "@/types";

type LatLng = { lat: number; lng: number };

interface Break {
  id: string;
  startedAt: string;
  endedAt?: string | null;
  reason?: string | null;
}

interface LiveRideMapEditorProps {
  rideId: string;
  session: LiveRideSession & { breaks?: Break[] };
  riders: LiveRiderLocation[];
  /** Confirmed registrants — used to populate the lead/sweep dropdowns. */
  registrants: { userId: string; name: string }[];
  initialPlannedRoute: LatLng[];
  onClose: () => void;
  onSaved: () => void;
}

type Tab = "planned" | "track" | "meta" | "stats";

export function LiveRideMapEditor({
  rideId,
  session,
  riders,
  registrants,
  initialPlannedRoute,
  onClose,
  onSaved,
}: LiveRideMapEditorProps) {
  const [tab, setTab] = useState<Tab>("planned");

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm p-4 pt-8">
      <div className="relative w-full max-w-5xl rounded-2xl border border-t2w-border bg-t2w-surface">
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-2xl border-b border-t2w-border bg-t2w-surface px-6 py-4">
          <div>
            <h2 className="font-display text-lg font-bold text-white">Edit Ride Map &amp; Stats</h2>
            <p className="text-xs text-t2w-muted">Super-admin and authorised core members — changes are visible to all registered riders.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-t2w-muted hover:bg-white/10 hover:text-white">
            Close
          </button>
        </div>

        <div className="flex gap-2 border-b border-t2w-border px-6 py-2 text-sm">
          {(
            [
              ["planned", "Planned route"],
              ["track", "Recorded track"],
              ["stats", "Statistics"],
              ["meta", "Session & breaks"],
            ] as [Tab, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`rounded-lg px-3 py-1.5 ${
                tab === key
                  ? "bg-t2w-accent/15 text-t2w-accent"
                  : "text-t2w-muted hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {tab === "planned" && (
            <PlannedRouteTab
              rideId={rideId}
              initial={initialPlannedRoute}
              onSaved={onSaved}
            />
          )}
          {tab === "track" && (
            <TrackTab rideId={rideId} session={session} riders={riders} registrants={registrants} onSaved={onSaved} />
          )}
          {tab === "stats" && (
            <StatsTab rideId={rideId} session={session} onSaved={onSaved} />
          )}
          {tab === "meta" && (
            <MetaTab rideId={rideId} session={session} registrants={registrants} onSaved={onSaved} />
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Planned route — Google Maps polyline with `editable: true`.
// ---------------------------------------------------------------------------
function PlannedRouteTab({
  rideId,
  initial,
  onSaved,
}: {
  rideId: string;
  initial: LatLng[];
  onSaved: () => void;
}) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const polyRef = useRef<google.maps.Polyline | null>(null);
  const [waypoints, setWaypoints] = useState<LatLng[]>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mount Google map + editable polyline once.
  useEffect(() => {
    if (!mapDivRef.current || mapRef.current || !window.google?.maps) return;
    const center = initial[0] || { lat: 12.97, lng: 77.59 };
    mapRef.current = new google.maps.Map(mapDivRef.current, {
      center,
      zoom: initial.length ? 10 : 6,
      mapId: "live-ride-editor",
      streetViewControl: false,
    });

    polyRef.current = new google.maps.Polyline({
      path: initial,
      strokeColor: "#ff4757",
      strokeWeight: 4,
      strokeOpacity: 0.9,
      editable: true,
      draggable: false,
      map: mapRef.current,
    });

    const sync = () => {
      const path = polyRef.current?.getPath();
      if (!path) return;
      const next: LatLng[] = [];
      for (let i = 0; i < path.getLength(); i++) {
        const p = path.getAt(i);
        next.push({ lat: p.lat(), lng: p.lng() });
      }
      setWaypoints(next);
    };
    const path = polyRef.current.getPath();
    const listeners = [
      path.addListener("set_at", sync),
      path.addListener("insert_at", sync),
      path.addListener("remove_at", sync),
    ];

    const clickListener = mapRef.current.addListener(
      "click",
      (e: google.maps.MapMouseEvent) => {
        if (!e.latLng || !polyRef.current) return;
        polyRef.current.getPath().push(e.latLng);
        sync();
      }
    );

    return () => {
      listeners.forEach((l) => l.remove());
      clickListener.remove();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.mapEdit.setPlannedRoute(rideId, waypoints);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleUploadGpx: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaving(true);
    setError(null);
    try {
      await api.mapEdit.uploadPlannedFromGpx(rideId, file);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setSaving(false);
      e.target.value = "";
    }
  };

  const handleReset = () => {
    if (!polyRef.current) return;
    polyRef.current.setPath(initial);
    setWaypoints(initial);
  };

  const handleClear = () => {
    polyRef.current?.setPath([]);
    setWaypoints([]);
  };

  // Snap waypoints to actual driving roads via Google Directions API. This
  // also gives an accurate ride kilometer count — straight-line haversine
  // under-counts switchback-heavy mountain rides by 20-60%.
  const handleSnapToRoads = async () => {
    if (waypoints.length < 2) return;
    if (!window.google?.maps?.DirectionsService) {
      setError("Google Maps is still loading — please retry in a moment.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const gms = window.google.maps;
      // Adapt the official DirectionsService to our test-friendly interface.
      const native = new gms.DirectionsService();
      const adapter: DirectionsServiceLike = {
        route: async (req) => {
          const result = await native.route({
            origin: req.origin,
            destination: req.destination,
            waypoints: req.waypoints?.map((w) => ({
              location: w.location,
              stopover: w.stopover,
            })),
            travelMode: gms.TravelMode.DRIVING,
          });
          return {
            routes: result.routes.map((r) => ({
              legs: r.legs.map((leg) => ({
                distance: { value: leg.distance?.value ?? 0 },
                steps: leg.steps.map((s) => ({
                  path: s.path.map((p) => ({ lat: p.lat(), lng: p.lng() })),
                })),
              })),
              overview_path: r.overview_path.map((p) => ({
                lat: p.lat(),
                lng: p.lng(),
              })),
            })),
          };
        },
      };

      const snapped = await snapWaypointsToRoads(waypoints, adapter);
      const proceed = window.confirm(
        `Snap will replace your ${waypoints.length} waypoints with ${snapped.path.length} road-following points.\n\n` +
          `Ride distance will update to ${snapped.distanceKm.toFixed(1)} km (from straight-line distance).\n\n` +
          `Continue?`
      );
      if (!proceed) return;

      await api.mapEdit.setPlannedRoute(rideId, snapped.path);
      await api.rides.update(rideId, { distanceKm: snapped.distanceKm });
      polyRef.current?.setPath(snapped.path);
      setWaypoints(snapped.path);
      onSaved();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Snap failed";
      if (/OVER_QUERY_LIMIT|REQUEST_DENIED/i.test(msg)) {
        setError(
          "Directions API is not enabled or over quota. Ask the admin to enable Directions API on the Google Maps key."
        );
      } else if (/ZERO_RESULTS|no route/i.test(msg)) {
        setError(
          "Google couldn't find a road route between some waypoints. Check that none of them are off-road."
        );
      } else {
        setError(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-t2w-muted">
        Drag the red polyline to reshape the planned route. Click the map to add waypoints. Mid-segment handles let you insert new ones.
        Use <span className="font-medium text-white">Snap to roads</span> to follow the actual driving path and get the real kilometer count.
      </p>
      <div
        ref={mapDivRef}
        className="h-[400px] w-full rounded-xl border border-t2w-border"
      />
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-t2w-muted">{waypoints.length} waypoints</span>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleReset} className="rounded-lg border border-t2w-border px-3 py-1.5 text-white hover:bg-white/10">Reset</button>
          <button onClick={handleClear} className="rounded-lg border border-t2w-border px-3 py-1.5 text-white hover:bg-white/10">Clear</button>
          <label className="cursor-pointer rounded-lg border border-t2w-border px-3 py-1.5 text-white hover:bg-white/10">
            Upload GPX
            <input type="file" accept=".gpx,application/gpx+xml,application/xml,text/xml" className="hidden" onChange={handleUploadGpx} />
          </label>
          <button
            onClick={handleSnapToRoads}
            disabled={saving || waypoints.length < 2}
            data-testid="snap-to-roads"
            className="rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-3 py-1.5 text-emerald-300 hover:bg-emerald-400/20 disabled:opacity-50"
          >
            Snap to roads
          </button>
          <button onClick={handleSave} disabled={saving || waypoints.length === 0} className="btn-primary disabled:opacity-50">
            {saving ? "Saving…" : "Save planned route"}
          </button>
        </div>
      </div>
      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
          <strong className="block text-xs uppercase tracking-wide text-red-400">Action failed</strong>
          <span className="break-words">{error}</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recorded track — pick a rider, then trim/replace.
// ---------------------------------------------------------------------------
function TrackTab({
  rideId,
  session,
  riders,
  registrants,
  onSaved,
}: {
  rideId: string;
  session: LiveRideSession;
  riders: LiveRiderLocation[];
  registrants: { userId: string; name: string }[];
  onSaved: () => void;
}) {
  const candidates = (() => {
    const seen = new Map<string, string>();
    if (session.leadRiderId) {
      const lead = riders.find((r) => r.userId === session.leadRiderId);
      if (lead) seen.set(lead.userId, `${lead.userName} (lead)`);
    }
    for (const r of riders) {
      if (!seen.has(r.userId)) seen.set(r.userId, r.userName);
    }
    for (const r of registrants) {
      if (!seen.has(r.userId)) seen.set(r.userId, r.name);
    }
    return Array.from(seen.entries()).map(([userId, label]) => ({ userId, label }));
  })();

  const [targetUserId, setTargetUserId] = useState<string>(
    session.leadRiderId || candidates[0]?.userId || ""
  );
  const [before, setBefore] = useState<string>("");
  const [after, setAfter] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Progress reporter for the bulk-smooth action. null = not running.
  const [bulkProgress, setBulkProgress] = useState<{
    done: number;
    total: number;
    failed: string[];
  } | null>(null);

  // Bulk smooth: run the smooth-track pipeline for every known rider in one
  // click. Each call is sequential because each ride spans several API
  // requests (Roads + Directions) and we'd rather queue politely than
  // hammer Google's per-second quota.
  const handleSmoothAll = async () => {
    if (candidates.length === 0) return;
    if (
      !confirm(
        `Run Smooth & fill for all ${candidates.length} rider${candidates.length !== 1 ? "s" : ""}? This commits directly (no preview) and may take a minute.`
      )
    ) {
      return;
    }
    setError(null);
    setMsg(null);
    setBulkProgress({ done: 0, total: candidates.length, failed: [] });
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      try {
        await api.mapEdit.smoothTrack(rideId, c.userId);
      } catch (err) {
        const label = `${c.label}: ${err instanceof Error ? err.message : "failed"}`;
        setBulkProgress((p) => p && { ...p, failed: [...p.failed, label] });
      }
      setBulkProgress((p) => p && { ...p, done: i + 1 });
    }
    setBulkProgress((p) => {
      if (!p) return null;
      setMsg(
        `Smoothed ${p.done - p.failed.length}/${p.total} riders.${p.failed.length ? ` ${p.failed.length} failed — see below.` : ""}`
      );
      return p;
    });
    onSaved();
  };

  const handleDelete = async () => {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const result = await api.mapEdit.deleteTrackPoints(rideId, {
        userId: targetUserId,
        before: before || undefined,
        after: after || undefined,
      });
      setMsg(`Deleted ${result.deleted} points.`);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  const handleUpload: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const result = await api.mapEdit.uploadRecordedFromGpx(rideId, file, targetUserId);
      setMsg(`Replaced ${result.replaced} points with ${result.inserted} new ones.`);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  const downloadUrl =
    targetUserId &&
    api.liveSession.downloadGpxUrl(rideId, "lead", targetUserId);

  return (
    <div className="space-y-4 text-sm">
      <p className="text-t2w-muted">
        Pick a rider, then trim noisy points by time range or replace the whole track from an uploaded GPX file.
      </p>

      {/* Bulk smooth across every rider — useful for a 20-rider ride where
          clicking Smooth & fill 20 times is tedious. Commits without
          preview; failures per rider are reported below. */}
      {candidates.length > 1 && (
        <div className="rounded-xl border border-sky-400/30 bg-sky-400/5 p-3 text-xs">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="font-semibold text-sky-200">Smooth all riders</p>
              <p className="text-sky-300/70">
                Runs the Roads + Directions pipeline for every tracked rider. Commits directly.
              </p>
            </div>
            <button
              onClick={handleSmoothAll}
              disabled={!!bulkProgress && bulkProgress.done < bulkProgress.total}
              data-testid="smooth-all"
              className="rounded-lg border border-sky-400/40 bg-sky-400/10 px-3 py-1.5 text-sky-200 hover:bg-sky-400/20 disabled:opacity-50"
            >
              {bulkProgress && bulkProgress.done < bulkProgress.total
                ? `Smoothing ${bulkProgress.done + 1} / ${bulkProgress.total}…`
                : `Smooth all ${candidates.length}`}
            </button>
          </div>
          {bulkProgress && bulkProgress.failed.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-amber-300">
              {bulkProgress.failed.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div>
        <label className="mb-1 block text-xs font-medium text-t2w-muted">Rider</label>
        <select
          value={targetUserId}
          onChange={(e) => setTargetUserId(e.target.value)}
          className="input-field w-full"
        >
          {candidates.length === 0 && <option value="">No riders tracked</option>}
          {candidates.map((c) => (
            <option key={c.userId} value={c.userId}>{c.label}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-t2w-muted">Delete points after</label>
          <input type="datetime-local" value={after} onChange={(e) => setAfter(e.target.value)} className="input-field w-full" />
          <p className="mt-1 text-xs text-t2w-muted">Trim noisy points recorded after this time.</p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-t2w-muted">Delete points before</label>
          <input type="datetime-local" value={before} onChange={(e) => setBefore(e.target.value)} className="input-field w-full" />
          <p className="mt-1 text-xs text-t2w-muted">Trim noisy points recorded before this time.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={handleDelete}
          disabled={busy || !targetUserId || (!before && !after)}
          className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-red-300 hover:bg-red-500/20 disabled:opacity-50"
        >
          {busy ? "Working…" : "Trim points"}
        </button>
        <label className={`cursor-pointer rounded-lg border border-t2w-border px-3 py-1.5 text-white hover:bg-white/10 ${(!targetUserId || busy) ? "opacity-50 pointer-events-none" : ""}`}>
          Replace from GPX
          <input type="file" accept=".gpx,application/gpx+xml,application/xml,text/xml" className="hidden" onChange={handleUpload} />
        </label>
        {downloadUrl && (
          <a
            href={downloadUrl}
            className="rounded-lg border border-t2w-border px-3 py-1.5 text-white hover:bg-white/10"
          >
            Download rider GPX
          </a>
        )}
      </div>

      <SmoothFillSection rideId={rideId} userId={targetUserId} disabled={busy || !targetUserId} onChanged={onSaved} />

      {msg && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-300">
          {msg}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
          <strong className="block text-xs uppercase tracking-wide text-red-400">Action failed</strong>
          <span className="break-words">{error}</span>
        </div>
      )}
    </div>
  );
}

interface SmoothStats {
  rawCount: number;
  snappedCount: number;
  interpolatedCount: number;
  gapsFilled: number;
  gapsSkipped: number;
  gapsTotalSeconds: number;
  movedPercent: number;
}

function SmoothFillSection({
  rideId,
  userId,
  disabled,
  onChanged,
}: {
  rideId: string;
  userId: string;
  disabled: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState<SmoothStats | null>(null);
  const [hasSmoothed, setHasSmoothed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-poll the smoothed read endpoint whenever the rider changes so the
  // "Revert to raw" button reflects reality.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    api.liveSmoothed
      .get(rideId, userId)
      .then((data) => {
        if (cancelled) return;
        setHasSmoothed((data.points ?? []).length > 0);
        setStats((data.stats as SmoothStats) ?? null);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [rideId, userId]);

  // Preview state: when set, the user has run smooth-with-preview but not
  // yet committed. The Track tab shows a yellow overlay (via parent state)
  // and offers Commit / Discard.
  const [previewStats, setPreviewStats] = useState<SmoothStats | null>(null);
  const [previewPoints, setPreviewPoints] = useState<number>(0);

  const handlePreview = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await api.mapEdit.smoothTrack(rideId, userId, { preview: true });
      setPreviewStats(result.stats);
      setPreviewPoints(result.points?.length ?? 0);
      if ((result.stats?.movedPercent ?? 0) > 10) {
        setError(
          `Roads API moved ${result.stats.movedPercent}% of points by a noticeable amount — this often happens on off-road sections. Inspect the preview before committing.`
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setBusy(false);
    }
  };

  const handleCommit = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await api.mapEdit.smoothTrack(rideId, userId);
      setStats(result.stats);
      setHasSmoothed(true);
      setPreviewStats(null);
      setPreviewPoints(0);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Commit failed");
    } finally {
      setBusy(false);
    }
  };

  const handleDiscardPreview = () => {
    setPreviewStats(null);
    setPreviewPoints(0);
  };

  const handleRevert = async () => {
    if (!confirm("Revert to raw recorded track for this rider?")) return;
    setBusy(true);
    setError(null);
    try {
      await api.mapEdit.revertSmoothedTrack(rideId, userId);
      setStats(null);
      setHasSmoothed(false);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Revert failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-t2w-border p-3">
      <h4 className="mb-1 text-sm font-semibold text-white">Smooth &amp; fill gaps</h4>
      <p className="mb-3 text-xs text-t2w-muted">
        Snaps recorded GPS to actual roads (Roads API) and fills any signal-loss gaps with the road segment between the surrounding points (Directions API). Raw data is preserved &mdash; revert any time.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={handlePreview}
          disabled={busy || disabled || !!previewStats}
          data-testid="smooth-track-preview"
          className="rounded-lg border border-sky-400/40 bg-sky-400/10 px-3 py-1.5 text-sm text-sky-300 hover:bg-sky-400/20 disabled:opacity-50"
        >
          {busy ? "Processing…" : hasSmoothed ? "Re-run preview" : "Preview smooth & fill"}
        </button>
        {previewStats && (
          <>
            <button
              onClick={handleCommit}
              disabled={busy}
              data-testid="smooth-track-commit"
              className="rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-1.5 text-sm text-green-300 hover:bg-green-500/20 disabled:opacity-50"
            >
              Commit preview
            </button>
            <button
              onClick={handleDiscardPreview}
              disabled={busy}
              className="rounded-lg border border-t2w-border px-3 py-1.5 text-sm text-white hover:bg-white/10 disabled:opacity-50"
            >
              Discard preview
            </button>
          </>
        )}
        {hasSmoothed && !previewStats && (
          <button
            onClick={handleRevert}
            disabled={busy}
            className="rounded-lg border border-t2w-border px-3 py-1.5 text-sm text-white hover:bg-white/10 disabled:opacity-50"
          >
            Revert to raw
          </button>
        )}
      </div>
      {previewStats && (
        <div className="mt-2 rounded-lg border border-sky-400/30 bg-sky-400/5 p-2 text-xs text-sky-200">
          Preview ready: {previewPoints} points · {previewStats.gapsFilled} gaps filled ·
          {" "}
          {Math.round(previewStats.gapsTotalSeconds / 60)} min of gaps. Click <strong>Commit preview</strong> to save.
        </div>
      )}
      {stats && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-t2w-muted sm:grid-cols-4">
          <Stat label="Raw points" value={String(stats.rawCount)} />
          <Stat label="Smoothed points" value={String(stats.snappedCount + stats.interpolatedCount)} />
          <Stat label="Gaps filled" value={`${stats.gapsFilled}${stats.gapsSkipped ? ` (+${stats.gapsSkipped} skipped)` : ""}`} />
          <Stat label="Gap time" value={`${Math.round(stats.gapsTotalSeconds / 60)} min`} />
        </div>
      )}
      {error && (
        <div className="mt-3 rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-xs text-amber-300">
          <strong className="block uppercase tracking-wide text-amber-400">Heads up</strong>
          <span className="break-words">{error}</span>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-t2w-border bg-white/5 p-2">
      <p className="text-[11px] uppercase tracking-wide text-t2w-muted">{label}</p>
      <p className="text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Session meta + breaks
// ---------------------------------------------------------------------------
function MetaTab({
  rideId,
  session,
  registrants,
  onSaved,
}: {
  rideId: string;
  session: LiveRideSession & { breaks?: Break[] };
  registrants: { userId: string; name: string }[];
  onSaved: () => void;
}) {
  const [leadRiderId, setLead] = useState(session.leadRiderId || "");
  const [sweepRiderId, setSweep] = useState(session.sweepRiderId || "");
  const [startedAt, setStartedAt] = useState(toLocalInput(session.startedAt));
  const [endedAt, setEndedAt] = useState(toLocalInput(session.endedAt));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const breaks = session.breaks ?? [];
  const [newBreak, setNewBreak] = useState({ startedAt: "", endedAt: "", reason: "" });

  const handleMetaSave = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.mapEdit.updateSessionMeta(rideId, {
        leadRiderId: leadRiderId || null,
        sweepRiderId: sweepRiderId || null,
        startedAt: startedAt ? new Date(startedAt).toISOString() : null,
        endedAt: endedAt ? new Date(endedAt).toISOString() : null,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const handleAddBreak = async () => {
    if (!newBreak.startedAt) return;
    setBusy(true);
    setError(null);
    try {
      await api.mapEdit.addBreak(rideId, {
        startedAt: new Date(newBreak.startedAt).toISOString(),
        endedAt: newBreak.endedAt ? new Date(newBreak.endedAt).toISOString() : undefined,
        reason: newBreak.reason || undefined,
      });
      setNewBreak({ startedAt: "", endedAt: "", reason: "" });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Add break failed");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteBreak = async (id: string) => {
    if (!confirm("Delete this break?")) return;
    setBusy(true);
    setError(null);
    try {
      await api.mapEdit.deleteBreak(rideId, id);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete break failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5 text-sm">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-t2w-muted">Lead rider</label>
          <select value={leadRiderId} onChange={(e) => setLead(e.target.value)} className="input-field w-full">
            <option value="">— None —</option>
            {registrants.map((r) => (
              <option key={r.userId} value={r.userId}>{r.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-t2w-muted">Sweep rider</label>
          <select value={sweepRiderId} onChange={(e) => setSweep(e.target.value)} className="input-field w-full">
            <option value="">— None —</option>
            {registrants.map((r) => (
              <option key={r.userId} value={r.userId}>{r.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-t2w-muted">Started at</label>
          <input type="datetime-local" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} className="input-field w-full" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-t2w-muted">Ended at</label>
          <input type="datetime-local" value={endedAt} onChange={(e) => setEndedAt(e.target.value)} className="input-field w-full" />
        </div>
      </div>
      <button onClick={handleMetaSave} disabled={busy} className="btn-primary disabled:opacity-50">
        {busy ? "Saving…" : "Save session meta"}
      </button>

      <div className="border-t border-t2w-border pt-4">
        <h4 className="mb-2 font-semibold text-white">Breaks</h4>
        {breaks.length === 0 && <p className="text-t2w-muted">No breaks recorded.</p>}
        {breaks.length > 0 && (
          <ul className="mb-3 space-y-2">
            {breaks.map((b) => (
              <li key={b.id} className="flex items-center justify-between rounded-lg border border-t2w-border p-2">
                <div>
                  <p className="text-white">{new Date(b.startedAt).toLocaleString()}{b.endedAt ? ` → ${new Date(b.endedAt).toLocaleString()}` : " (open)"}</p>
                  {b.reason && <p className="text-xs text-t2w-muted">{b.reason}</p>}
                </div>
                <button
                  onClick={() => handleDeleteBreak(b.id)}
                  className="rounded-lg border border-red-500/40 px-2 py-1 text-xs text-red-300 hover:bg-red-500/10"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <input type="datetime-local" value={newBreak.startedAt} onChange={(e) => setNewBreak({ ...newBreak, startedAt: e.target.value })} className="input-field" placeholder="Start" />
          <input type="datetime-local" value={newBreak.endedAt} onChange={(e) => setNewBreak({ ...newBreak, endedAt: e.target.value })} className="input-field" placeholder="End" />
          <input type="text" value={newBreak.reason} onChange={(e) => setNewBreak({ ...newBreak, reason: e.target.value })} className="input-field" placeholder="Reason (optional)" />
        </div>
        <button
          onClick={handleAddBreak}
          disabled={busy || !newBreak.startedAt}
          className="mt-2 rounded-lg border border-t2w-border px-3 py-1.5 text-white hover:bg-white/10 disabled:opacity-50"
        >
          Add break
        </button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}

function toLocalInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  // strip seconds and timezone for <input type="datetime-local">
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ---------------------------------------------------------------------------
// Statistics — override the computed metrics when auto-computation is off
// (GPS gaps producing 0 km, bunched offline timestamps blowing up moving
// time, etc.). Each override is independent — clear with the button next
// to the input to fall back to the computed value.
// ---------------------------------------------------------------------------
interface MetricsPayload {
  elapsedMinutes: number;
  movingMinutes: number;
  distanceKm: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  elevationGainM: number | null;
  elevationLossM: number | null;
  overrides?: {
    distanceKm: number | null;
    avgSpeedKmh: number | null;
    maxSpeedKmh: number | null;
    movingMinutes: number | null;
  };
  computed?: {
    distanceKm: number;
    avgSpeedKmh: number;
    maxSpeedKmh: number;
    movingMinutes: number;
  };
}

function StatsTab({
  rideId,
  session,
  onSaved,
}: {
  rideId: string;
  session: LiveRideSession & { breaks?: Break[] };
  onSaved: () => void;
}) {
  // Use a string-keyed shape so empty inputs map to "" (= "clear override")
  // and number inputs round-trip without NaN games.
  const [form, setForm] = useState({
    distanceKm: "",
    avgSpeedKmh: "",
    maxSpeedKmh: "",
    movingMinutes: "",
    elevationGainM: "",
    elevationLossM: "",
  });
  const [metrics, setMetrics] = useState<MetricsPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  // Hydrate from /metrics on mount so we show the live numbers alongside
  // any existing overrides. Re-fetch after save so badges update.
  const refresh = async () => {
    try {
      const m: MetricsPayload = await api.liveSession.metrics(rideId);
      setMetrics(m);
      setForm({
        distanceKm: m.overrides?.distanceKm != null ? String(m.overrides.distanceKm) : "",
        avgSpeedKmh: m.overrides?.avgSpeedKmh != null ? String(m.overrides.avgSpeedKmh) : "",
        maxSpeedKmh: m.overrides?.maxSpeedKmh != null ? String(m.overrides.maxSpeedKmh) : "",
        movingMinutes: m.overrides?.movingMinutes != null ? String(m.overrides.movingMinutes) : "",
        elevationGainM: m.elevationGainM != null ? String(m.elevationGainM) : "",
        elevationLossM: m.elevationLossM != null ? String(m.elevationLossM) : "",
      });
    } catch {
      // ignore — page header already renders metrics
    }
  };
  useEffect(() => {
    void refresh();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rideId]);

  // Convert a form field to the payload value: "" → null (clear), valid
  // numeric string → number, anything else → undefined (don't touch).
  const numOr = (raw: string, integer = false): number | null | undefined => {
    if (raw === "") return null;
    const n = integer ? parseInt(raw, 10) : parseFloat(raw);
    if (!Number.isFinite(n) || n < 0) return undefined;
    return n;
  };

  const handleSave = async () => {
    setBusy(true);
    setError(null);
    try {
      const payload: Record<string, number | null> = {};
      const fields: { key: keyof typeof form; out: string; integer?: boolean }[] = [
        { key: "distanceKm", out: "distanceKmOverride" },
        { key: "avgSpeedKmh", out: "avgSpeedKmhOverride" },
        { key: "maxSpeedKmh", out: "maxSpeedKmhOverride" },
        { key: "movingMinutes", out: "movingMinutesOverride", integer: true },
        { key: "elevationGainM", out: "elevationGainM", integer: true },
        { key: "elevationLossM", out: "elevationLossM", integer: true },
      ];
      for (const f of fields) {
        const v = numOr(form[f.key], f.integer);
        if (v === undefined) {
          setError(`${f.key} must be a non-negative number or empty (to clear)`);
          setBusy(false);
          return;
        }
        payload[f.out] = v;
      }
      await api.mapEdit.updateStats(rideId, payload);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
      await refresh();
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const clearOne = (key: keyof typeof form) => {
    setForm((f) => ({ ...f, [key]: "" }));
  };

  // Single-row renderer for an override input. Shows the current effective
  // value, the computed fallback, and a Clear button when an override is set.
  const Row = ({
    label,
    field,
    suffix,
    integer,
    computed,
  }: {
    label: string;
    field: keyof typeof form;
    suffix: string;
    integer?: boolean;
    computed?: number | null;
  }) => (
    <div className="grid grid-cols-12 items-center gap-3 border-b border-t2w-border/60 py-2 text-sm last:border-b-0">
      <label className="col-span-4 text-t2w-muted">{label}</label>
      <div className="col-span-5 flex items-center gap-2">
        <input
          type="number"
          inputMode={integer ? "numeric" : "decimal"}
          step={integer ? 1 : 0.1}
          min={0}
          value={form[field]}
          onChange={(e) => setForm({ ...form, [field]: e.target.value })}
          placeholder={computed != null ? `computed: ${computed}` : "—"}
          className="input-field w-32"
        />
        <span className="text-xs text-t2w-muted">{suffix}</span>
        {form[field] !== "" && (
          <button
            type="button"
            onClick={() => clearOne(field)}
            className="text-xs text-t2w-muted underline hover:text-white"
          >
            clear
          </button>
        )}
      </div>
      <div className="col-span-3 text-right text-xs text-t2w-muted">
        {computed != null ? `auto: ${computed} ${suffix}` : "auto: n/a"}
      </div>
    </div>
  );

  return (
    <div className="space-y-4 text-sm">
      <p className="text-t2w-muted">
        Override the auto-computed ride statistics. Leave an input blank (or click <em>clear</em>) to fall back to the auto value. Elevation fields directly replace the Google-API-backfilled numbers — they don&apos;t fall back.
      </p>

      <div className="rounded-xl border border-t2w-border bg-t2w-surface-light/30 p-4">
        <Row
          label="Distance"
          field="distanceKm"
          suffix="km"
          computed={metrics?.computed?.distanceKm ?? null}
        />
        <Row
          label="Moving time"
          field="movingMinutes"
          suffix="min"
          integer
          computed={metrics?.computed?.movingMinutes ?? null}
        />
        <Row
          label="Average speed"
          field="avgSpeedKmh"
          suffix="km/h"
          computed={metrics?.computed?.avgSpeedKmh ?? null}
        />
        <Row
          label="Max speed"
          field="maxSpeedKmh"
          suffix="km/h"
          computed={metrics?.computed?.maxSpeedKmh ?? null}
        />
        <Row
          label="Elevation gain"
          field="elevationGainM"
          suffix="m"
          integer
          computed={session.elevationGainM ?? null}
        />
        <Row
          label="Elevation loss"
          field="elevationLossM"
          suffix="m"
          integer
          computed={session.elevationLossM ?? null}
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={busy}
          data-testid="save-stats"
          className="btn-primary disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save stats"}
        </button>
        {savedFlash && <span className="text-xs text-green-400">Saved ✓</span>}
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      )}
    </div>
  );
}
