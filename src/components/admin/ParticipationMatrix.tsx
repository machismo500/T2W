"use client";

import { useState, useMemo } from "react";
import { Search, Check, X, Save, Loader2 } from "lucide-react";
import { riderProfiles } from "@/data/rider-profiles";
import { pastRides } from "@/data/past-rides";
import { api } from "@/lib/api-client";

interface Props {
  isSuperAdmin: boolean;
}

export function ParticipationMatrix({ isSuperAdmin }: Props) {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [overrides, setOverrides] = useState<
    Record<string, { added: string[]; removed: string[] }>
  >(() => api.participation.getOverrides());
  // Track local changes during edit mode
  const [localChanges, setLocalChanges] = useState<
    Record<string, Record<string, boolean>>
  >({});

  // Sort rides by number
  const sortedRides = useMemo(
    () =>
      [...pastRides].sort((a, b) => {
        const numA = parseInt(a.rideNumber.replace("#", ""));
        const numB = parseInt(b.rideNumber.replace("#", ""));
        return numA - numB;
      }),
    []
  );

  // Filter riders by search
  const filteredRiders = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return riderProfiles;
    return riderProfiles.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q)
    );
  }, [search]);

  // Get effective participation for a rider considering overrides
  const isParticipating = (riderId: string, rideId: string): boolean => {
    // Check local changes first (edit mode)
    if (editing && localChanges[riderId]?.[rideId] !== undefined) {
      return localChanges[riderId][rideId];
    }
    // Check overrides
    const riderOverrides = overrides[riderId];
    const rider = riderProfiles.find((r) => r.id === riderId);
    const hasInBase =
      rider?.ridesParticipated.some((r) => r.rideId === rideId) || false;
    if (!riderOverrides) return hasInBase;
    if (riderOverrides.removed.includes(rideId)) return false;
    if (riderOverrides.added.includes(rideId)) return true;
    return hasInBase;
  };

  const handleToggle = (riderId: string, rideId: string) => {
    if (!editing) return;
    const current = isParticipating(riderId, rideId);
    setLocalChanges((prev) => ({
      ...prev,
      [riderId]: {
        ...(prev[riderId] || {}),
        [rideId]: !current,
      },
    }));
  };

  const handleSave = () => {
    setSaving(true);
    // Apply all local changes via the API
    for (const [riderId, rides] of Object.entries(localChanges)) {
      for (const [rideId, participate] of Object.entries(rides)) {
        api.participation.toggle(riderId, rideId, participate);
      }
    }
    // Reload overrides
    setOverrides(api.participation.getOverrides());
    setLocalChanges({});
    setEditing(false);
    setSaving(false);
  };

  const handleCancel = () => {
    setLocalChanges({});
    setEditing(false);
  };

  // Count rides per rider
  const getRideCount = (riderId: string): number => {
    return sortedRides.filter((ride) =>
      isParticipating(riderId, ride.id)
    ).length;
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-white">
            Rider-Ride Participation Matrix
          </h2>
          <p className="text-sm text-t2w-muted">
            {riderProfiles.length} riders &middot; {pastRides.length} rides
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-t2w-muted" />
            <input
              type="text"
              placeholder="Search riders..."
              className="input-field pl-10"
              style={{ minWidth: 200 }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {isSuperAdmin && !editing && (
            <button
              onClick={() => setEditing(true)}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              Edit Matrix
            </button>
          )}
          {editing && (
            <>
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-primary flex items-center gap-2 text-sm"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Changes
              </button>
              <button
                onClick={handleCancel}
                className="flex items-center gap-2 rounded-xl border border-t2w-border bg-t2w-surface-light px-4 py-2 text-sm font-medium text-t2w-muted transition-colors hover:text-white"
              >
                <X className="h-4 w-4" />
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {/* Matrix table */}
      <div className="overflow-auto rounded-xl border border-t2w-border bg-t2w-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-t2w-border">
              <th className="sticky left-0 z-20 bg-t2w-surface-light px-4 py-3 text-left font-semibold text-white min-w-[200px]">
                Rider
              </th>
              <th className="sticky left-0 z-10 bg-t2w-surface-light px-2 py-3 text-center font-semibold text-t2w-accent min-w-[50px]">
                #
              </th>
              {sortedRides.map((ride) => (
                <th
                  key={ride.id}
                  className="bg-t2w-surface-light px-1 py-3 text-center font-medium text-t2w-muted min-w-[44px]"
                  title={`${ride.rideNumber} - ${ride.title}`}
                >
                  <div className="flex flex-col items-center">
                    <span className="text-xs">
                      {ride.rideNumber.replace("#0", "#").replace("#", "")}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRiders.map((rider, idx) => {
              const count = getRideCount(rider.id);
              return (
                <tr
                  key={rider.id}
                  className={`border-b border-t2w-border/50 transition-colors hover:bg-t2w-surface-light/50 ${
                    idx % 2 === 0 ? "bg-t2w-surface" : "bg-t2w-surface/80"
                  }`}
                >
                  <td className="sticky left-0 z-10 bg-inherit px-4 py-2 font-medium text-white whitespace-nowrap">
                    <span title={rider.email}>{rider.name}</span>
                  </td>
                  <td className="sticky z-10 bg-inherit px-2 py-2 text-center font-bold text-t2w-accent">
                    {count}
                  </td>
                  {sortedRides.map((ride) => {
                    const participating = isParticipating(rider.id, ride.id);
                    const hasLocalChange =
                      localChanges[rider.id]?.[ride.id] !== undefined;
                    return (
                      <td
                        key={ride.id}
                        className={`px-1 py-2 text-center ${
                          editing ? "cursor-pointer" : ""
                        } ${hasLocalChange ? "bg-yellow-400/10" : ""}`}
                        onClick={() => handleToggle(rider.id, ride.id)}
                      >
                        {participating ? (
                          <Check className="mx-auto h-4 w-4 text-green-400" />
                        ) : (
                          <span className="text-t2w-border">&mdash;</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filteredRiders.length === 0 && (
        <div className="py-12 text-center text-t2w-muted">
          No riders found matching &quot;{search}&quot;
        </div>
      )}
    </div>
  );
}
