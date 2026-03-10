"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Merge, AlertTriangle, CheckCircle, Search, ArrowRight } from "lucide-react";
import { api } from "@/lib/api-client";

interface DuplicateGroup {
  type: "email" | "name";
  key: string;
  profiles: Array<{
    id: string;
    name: string;
    email: string;
    phone: string;
  }>;
}

export function MergeProfiles() {
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [merging, setMerging] = useState<string | null>(null);
  const [mergeResult, setMergeResult] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Manual merge state
  const [manualSourceId, setManualSourceId] = useState("");
  const [manualTargetId, setManualTargetId] = useState("");
  const [allRiders, setAllRiders] = useState<Array<{ id: string; name: string; email: string }>>([]);

  const loadDuplicates = useCallback(async () => {
    setLoading(true);
    try {
      const [dupData, ridersData] = await Promise.all([
        api.merge.findDuplicates(),
        api.riders.list(),
      ]);
      setDuplicates(dupData.duplicates || []);
      setAllRiders(
        (ridersData.riders || []).map((r: Record<string, unknown>) => ({
          id: r.id as string,
          name: r.name as string,
          email: r.email as string,
        }))
      );
    } catch (err) {
      console.error("Failed to load duplicates:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDuplicates();
  }, [loadDuplicates]);

  const handleMerge = async (sourceId: string, targetId: string) => {
    const source = allRiders.find((r) => r.id === sourceId);
    const target = allRiders.find((r) => r.id === targetId);
    if (!confirm(
      `Merge "${source?.name || sourceId}" INTO "${target?.name || targetId}"?\n\n` +
      `All participation data from "${source?.name}" will be moved to "${target?.name}".\n` +
      `"${source?.name}" will be marked as merged and hidden.`
    )) return;

    setMerging(sourceId);
    setMergeResult(null);
    try {
      const result = await api.merge.mergeProfiles(sourceId, targetId);
      setMergeResult(
        `Merged "${result.mergedFrom}" into "${result.mergedInto}" — ${result.participationsMoved} participation records moved.`
      );
      await loadDuplicates();
    } catch (err) {
      console.error("Merge failed:", err);
      setMergeResult("Merge failed. Please try again.");
    } finally {
      setMerging(null);
    }
  };

  const handleManualMerge = async () => {
    if (!manualSourceId || !manualTargetId) return;
    if (manualSourceId === manualTargetId) {
      setMergeResult("Cannot merge a profile into itself.");
      return;
    }
    await handleMerge(manualSourceId, manualTargetId);
    setManualSourceId("");
    setManualTargetId("");
  };

  const filteredDuplicates = duplicates.filter((d) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return d.key.includes(q) || d.profiles.some((p) => p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q));
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-t2w-accent" />
        <span className="ml-3 text-t2w-muted">Scanning for duplicate profiles...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Result message */}
      {mergeResult && (
        <div className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${
          mergeResult.includes("failed")
            ? "border-red-500/30 bg-red-500/10 text-red-400"
            : "border-green-500/30 bg-green-500/10 text-green-400"
        }`}>
          {mergeResult.includes("failed") ? (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          {mergeResult}
        </div>
      )}

      {/* Manual Merge */}
      <div className="card">
        <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-white">
          <Merge className="h-5 w-5 text-t2w-accent" />
          Manual Profile Merge
        </h3>
        <p className="mb-4 text-sm text-t2w-muted">
          Select a source profile to merge INTO a target profile. All participation data will be transferred to the target.
        </p>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="mb-1 block text-xs text-t2w-muted">Source (will be merged/removed)</label>
            <select
              value={manualSourceId}
              onChange={(e) => setManualSourceId(e.target.value)}
              className="input-field"
            >
              <option value="">Select source profile...</option>
              {allRiders.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.email})
                </option>
              ))}
            </select>
          </div>
          <ArrowRight className="h-5 w-5 text-t2w-muted shrink-0 mb-2" />
          <div className="flex-1 min-w-[200px]">
            <label className="mb-1 block text-xs text-t2w-muted">Target (will keep all data)</label>
            <select
              value={manualTargetId}
              onChange={(e) => setManualTargetId(e.target.value)}
              className="input-field"
            >
              <option value="">Select target profile...</option>
              {allRiders.filter((r) => r.id !== manualSourceId).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.email})
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleManualMerge}
            disabled={!manualSourceId || !manualTargetId || !!merging}
            className="btn-primary flex items-center gap-2 mb-0"
          >
            {merging ? <Loader2 className="h-4 w-4 animate-spin" /> : <Merge className="h-4 w-4" />}
            Merge
          </button>
        </div>
      </div>

      {/* Auto-detected Duplicates */}
      <div className="card">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-display text-lg font-bold text-white">
            <AlertTriangle className="h-5 w-5 text-yellow-400" />
            Detected Duplicates ({duplicates.length})
          </h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-t2w-muted" />
            <input
              type="text"
              placeholder="Search..."
              className="input-field pl-10"
              style={{ minWidth: 200 }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {filteredDuplicates.length === 0 ? (
          <div className="py-8 text-center text-t2w-muted">
            {duplicates.length === 0 ? (
              <>
                <CheckCircle className="mx-auto mb-2 h-8 w-8 text-green-400" />
                No duplicate profiles detected.
              </>
            ) : (
              "No duplicates match your search."
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredDuplicates.map((dup, idx) => (
              <div key={idx} className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm">
                  <span className={`rounded-lg px-2 py-0.5 text-xs font-semibold ${
                    dup.type === "email" ? "bg-blue-400/10 text-blue-400" : "bg-orange-400/10 text-orange-400"
                  }`}>
                    {dup.type === "email" ? "Same Email" : "Same Name"}
                  </span>
                  <span className="text-t2w-muted">{dup.key}</span>
                </div>
                <div className="space-y-2">
                  {dup.profiles.map((profile, pIdx) => (
                    <div key={profile.id} className="flex items-center justify-between rounded-lg bg-t2w-surface p-3">
                      <div>
                        <span className="font-medium text-white">{profile.name}</span>
                        <span className="ml-2 text-xs text-t2w-muted">{profile.email}</span>
                        {profile.phone && (
                          <span className="ml-2 text-xs text-t2w-muted">{profile.phone}</span>
                        )}
                        <span className="ml-2 text-xs text-t2w-muted/50">ID: {profile.id.slice(0, 8)}...</span>
                      </div>
                      <div className="flex gap-2">
                        {pIdx > 0 && (
                          <button
                            onClick={() => handleMerge(profile.id, dup.profiles[0].id)}
                            disabled={!!merging}
                            className="flex items-center gap-1 rounded-lg bg-t2w-accent/10 px-3 py-1.5 text-xs font-medium text-t2w-accent transition-colors hover:bg-t2w-accent/20"
                          >
                            {merging === profile.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Merge className="h-3 w-3" />
                            )}
                            Merge into {dup.profiles[0].name}
                          </button>
                        )}
                        {pIdx === 0 && (
                          <span className="rounded-lg bg-green-400/10 px-3 py-1.5 text-xs font-medium text-green-400">
                            Primary
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
