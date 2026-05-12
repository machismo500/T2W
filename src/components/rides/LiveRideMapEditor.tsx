"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api-client";
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

type Tab = "planned" | "track" | "meta";

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
            <h2 className="font-display text-lg font-bold text-white">Edit Ride Map</h2>
            <p className="text-xs text-t2w-muted">Super-admin only — changes are visible to all registered riders.</p>
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

  return (
    <div className="space-y-3">
      <p className="text-sm text-t2w-muted">
        Drag the red polyline to reshape the planned route. Click the map to add waypoints. Mid-segment handles let you insert new ones.
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
          <button onClick={handleSave} disabled={saving || waypoints.length === 0} className="btn-primary disabled:opacity-50">
            {saving ? "Saving…" : "Save planned route"}
          </button>
        </div>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
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

      {msg && <p className="text-sm text-green-400">{msg}</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}
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
