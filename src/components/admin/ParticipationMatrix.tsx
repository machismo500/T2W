"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { Search, Check, X, Save, Loader2, UserPlus, Trash2 } from "lucide-react";
import { pastRides } from "@/data/past-rides";
import { mockUpcomingRides } from "@/data/mock";
import {
  getGridRiders,
  setGridParticipation,
  updateGridRider,
  addGridRider,
  deleteGridRider,
  type GridRider,
} from "@/lib/grid-store";

interface Props {
  isSuperAdmin: boolean;
}

export function ParticipationMatrix({ isSuperAdmin }: Props) {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [riders, setRiders] = useState<GridRider[]>([]);
  const [showAddRider, setShowAddRider] = useState(false);
  const [newRiderName, setNewRiderName] = useState("");
  const [newRiderEmail, setNewRiderEmail] = useState("");
  const [newRiderPhone, setNewRiderPhone] = useState("");
  const [editingRider, setEditingRider] = useState<string | null>(null);
  const [editRiderForm, setEditRiderForm] = useState({ name: "", email: "", phone: "", address: "", emergencyContact: "", emergencyPhone: "" });

  // Track local changes during edit mode: riderId -> rideId -> points (0 = remove)
  const [localChanges, setLocalChanges] = useState<
    Record<string, Record<string, number>>
  >({});

  // Load riders from grid store
  const loadRiders = useCallback(() => {
    setRiders(getGridRiders());
  }, []);

  useEffect(() => {
    loadRiders();
    // Listen for storage updates from other components
    const handler = () => loadRiders();
    window.addEventListener("t2w-storage-update", handler);
    return () => window.removeEventListener("t2w-storage-update", handler);
  }, [loadRiders]);

  // All rides sorted by number
  const allRides = useMemo(
    () =>
      [...pastRides, ...mockUpcomingRides].sort((a, b) => {
        const numA = parseInt(a.rideNumber.replace("#", ""));
        const numB = parseInt(b.rideNumber.replace("#", ""));
        return numA - numB;
      }),
    []
  );

  // Filter riders by search
  const filteredRiders = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return riders;
    return riders.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q)
    );
  }, [search, riders]);

  // Get effective points for a rider in a ride
  const getPoints = (riderId: string, rideId: string): number => {
    // Check local changes first (edit mode)
    if (editing && localChanges[riderId]?.[rideId] !== undefined) {
      return localChanges[riderId][rideId];
    }
    const rider = riders.find((r) => r.id === riderId);
    return rider?.participationMap[rideId] || 0;
  };

  const isParticipating = (riderId: string, rideId: string): boolean => {
    return getPoints(riderId, rideId) > 0;
  };

  // Cycle through points: 0 -> 5 -> 7.5 -> 10 -> 0
  const handleToggle = (riderId: string, rideId: string) => {
    if (!editing) return;
    const current = getPoints(riderId, rideId);
    let next: number;
    if (current === 0) next = 5;
    else if (current === 5) next = 7.5;
    else if (current === 7.5) next = 10;
    else next = 0;

    setLocalChanges((prev) => ({
      ...prev,
      [riderId]: {
        ...(prev[riderId] || {}),
        [rideId]: next,
      },
    }));
  };

  const handleSave = () => {
    setSaving(true);
    // Apply all local participation changes to grid store
    for (const [riderId, rides] of Object.entries(localChanges)) {
      for (const [rideId, points] of Object.entries(rides)) {
        setGridParticipation(riderId, rideId, points);
      }
    }
    // Reload from grid store
    loadRiders();
    setLocalChanges({});
    setEditing(false);
    setSaving(false);
  };

  const handleCancel = () => {
    setLocalChanges({});
    setEditing(false);
  };

  const handleAddRider = () => {
    if (!newRiderName.trim()) return;
    const id = `rider-${Date.now()}`;
    addGridRider({
      id,
      name: newRiderName.trim(),
      email: newRiderEmail.trim().toLowerCase(),
      phone: newRiderPhone.trim(),
      address: "",
      emergencyContact: "",
      emergencyPhone: "",
      bloodGroup: "",
      joinDate: new Date().toISOString().split("T")[0],
      avatarUrl: undefined,
    });
    setNewRiderName("");
    setNewRiderEmail("");
    setNewRiderPhone("");
    setShowAddRider(false);
    loadRiders();
  };

  const handleDeleteRider = (riderId: string) => {
    if (!confirm("Are you sure you want to remove this rider from the grid?")) return;
    deleteGridRider(riderId);
    loadRiders();
  };

  const handleEditRider = (rider: GridRider) => {
    setEditingRider(rider.id);
    setEditRiderForm({
      name: rider.name,
      email: rider.email,
      phone: rider.phone,
      address: rider.address,
      emergencyContact: rider.emergencyContact,
      emergencyPhone: rider.emergencyPhone,
    });
  };

  const handleSaveRiderEdit = () => {
    if (!editingRider) return;
    updateGridRider(editingRider, editRiderForm);
    setEditingRider(null);
    loadRiders();
  };

  // Count rides per rider
  const getRideCount = (riderId: string): number => {
    return allRides.filter((ride) => isParticipating(riderId, ride.id)).length;
  };

  // Get total points per rider
  const getTotalPoints = (riderId: string): number => {
    return allRides.reduce((sum, ride) => sum + getPoints(riderId, ride.id), 0);
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-white">
            Rider-Ride Participation Grid
          </h2>
          <p className="text-sm text-t2w-muted">
            {riders.length} riders &middot; {allRides.length} rides &middot; Primary Database
          </p>
          <p className="text-xs text-t2w-muted/70 mt-1">
            Click cells to cycle: -- &rarr; 5 &rarr; 7.5 &rarr; 10 &rarr; --
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
            <div className="flex gap-2">
              <button
                onClick={() => setEditing(true)}
                className="btn-primary flex items-center gap-2 text-sm"
              >
                Edit Matrix
              </button>
              <button
                onClick={() => setShowAddRider(true)}
                className="flex items-center gap-2 rounded-xl border border-t2w-border bg-t2w-surface-light px-4 py-2 text-sm font-medium text-t2w-accent transition-colors hover:bg-t2w-accent/20"
              >
                <UserPlus className="h-4 w-4" />
                Add Rider
              </button>
            </div>
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

      {/* Add Rider Modal */}
      {showAddRider && (
        <div className="mb-6 rounded-xl border border-t2w-accent/30 bg-t2w-surface-light p-4">
          <h3 className="mb-3 text-sm font-semibold text-white">Add New Rider</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <input type="text" placeholder="Full Name *" value={newRiderName} onChange={(e) => setNewRiderName(e.target.value)} className="input-field" />
            <input type="email" placeholder="Email" value={newRiderEmail} onChange={(e) => setNewRiderEmail(e.target.value)} className="input-field" />
            <input type="text" placeholder="Phone" value={newRiderPhone} onChange={(e) => setNewRiderPhone(e.target.value)} className="input-field" />
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={handleAddRider} className="btn-primary text-sm">Add Rider</button>
            <button onClick={() => setShowAddRider(false)} className="text-sm text-t2w-muted hover:text-white">Cancel</button>
          </div>
        </div>
      )}

      {/* Edit Rider Modal */}
      {editingRider && (
        <div className="mb-6 rounded-xl border border-t2w-accent/30 bg-t2w-surface-light p-4">
          <h3 className="mb-3 text-sm font-semibold text-white">Edit Rider Details</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <input type="text" placeholder="Full Name" value={editRiderForm.name} onChange={(e) => setEditRiderForm({ ...editRiderForm, name: e.target.value })} className="input-field" />
            <input type="email" placeholder="Email" value={editRiderForm.email} onChange={(e) => setEditRiderForm({ ...editRiderForm, email: e.target.value })} className="input-field" />
            <input type="text" placeholder="Phone" value={editRiderForm.phone} onChange={(e) => setEditRiderForm({ ...editRiderForm, phone: e.target.value })} className="input-field" />
            <input type="text" placeholder="Address" value={editRiderForm.address} onChange={(e) => setEditRiderForm({ ...editRiderForm, address: e.target.value })} className="input-field" />
            <input type="text" placeholder="Emergency Contact" value={editRiderForm.emergencyContact} onChange={(e) => setEditRiderForm({ ...editRiderForm, emergencyContact: e.target.value })} className="input-field" />
            <input type="text" placeholder="Emergency Phone" value={editRiderForm.emergencyPhone} onChange={(e) => setEditRiderForm({ ...editRiderForm, emergencyPhone: e.target.value })} className="input-field" />
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={handleSaveRiderEdit} className="btn-primary text-sm">Save</button>
            <button onClick={() => setEditingRider(null)} className="text-sm text-t2w-muted hover:text-white">Cancel</button>
          </div>
        </div>
      )}

      {/* Matrix table */}
      <div className="overflow-auto rounded-xl border border-t2w-border bg-t2w-surface" style={{ maxHeight: "70vh" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-t2w-border">
              <th className="sticky left-0 z-20 bg-t2w-surface-light px-4 py-3 text-left font-semibold text-white min-w-[200px]">
                Rider
              </th>
              <th className="sticky z-10 bg-t2w-surface-light px-2 py-3 text-center font-semibold text-t2w-accent min-w-[40px]" title="Total Rides">
                #
              </th>
              <th className="sticky z-10 bg-t2w-surface-light px-2 py-3 text-center font-semibold text-t2w-gold min-w-[50px]" title="Total Points">
                Pts
              </th>
              {allRides.map((ride) => (
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
              {isSuperAdmin && (
                <th className="bg-t2w-surface-light px-2 py-3 text-center font-medium text-t2w-muted min-w-[60px]">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {filteredRiders.map((rider, idx) => {
              const count = getRideCount(rider.id);
              const points = getTotalPoints(rider.id);
              return (
                <tr
                  key={rider.id}
                  className={`border-b border-t2w-border/50 transition-colors hover:bg-t2w-surface-light/50 ${
                    idx % 2 === 0 ? "bg-t2w-surface" : "bg-t2w-surface/80"
                  }`}
                >
                  <td className="sticky left-0 z-10 bg-inherit px-4 py-2 font-medium text-white whitespace-nowrap">
                    <span title={`${rider.email}\n${rider.phone}`}>{rider.name}</span>
                  </td>
                  <td className="sticky z-10 bg-inherit px-2 py-2 text-center font-bold text-t2w-accent">
                    {count}
                  </td>
                  <td className="sticky z-10 bg-inherit px-2 py-2 text-center font-bold text-t2w-gold text-xs">
                    {points}
                  </td>
                  {allRides.map((ride) => {
                    const pts = getPoints(rider.id, ride.id);
                    const participating = pts > 0;
                    const hasLocalChange =
                      localChanges[rider.id]?.[ride.id] !== undefined;
                    return (
                      <td
                        key={ride.id}
                        className={`px-1 py-2 text-center ${
                          editing ? "cursor-pointer hover:bg-t2w-accent/10" : ""
                        } ${hasLocalChange ? "bg-yellow-400/10" : ""}`}
                        onClick={() => handleToggle(rider.id, ride.id)}
                        title={participating ? `${pts} points` : "Not participated"}
                      >
                        {participating ? (
                          <span className="text-xs font-bold text-green-400">{pts}</span>
                        ) : (
                          <span className="text-t2w-border">&mdash;</span>
                        )}
                      </td>
                    );
                  })}
                  {isSuperAdmin && (
                    <td className="px-2 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleEditRider(rider)}
                          className="rounded p-1 text-t2w-muted hover:text-t2w-accent"
                          title="Edit rider details"
                        >
                          <Save className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteRider(rider.id)}
                          className="rounded p-1 text-t2w-muted hover:text-red-400"
                          title="Remove rider"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  )}
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
