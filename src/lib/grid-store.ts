/**
 * Centralized Grid Data Store
 *
 * This is the PRIMARY database for all rider and ride-participation data.
 * The Super Admin grid in the admin panel is the UI for this store.
 * All changes made here are reflected across the entire website:
 *   - Rider profile pages
 *   - Rides pages (rider lists)
 *   - User management
 *   - Dashboard stats
 *
 * Data flow:
 *   1. On first load, seed from static riderProfiles (from Excel import)
 *   2. Super Admin edits via grid -> persisted to localStorage
 *   3. All components read from this store (never directly from static data)
 *   4. On registration, if email matches a grid rider, account is merged
 */

import {
  riderProfiles as staticRiderProfiles,
  type RiderProfile,
} from "@/data/rider-profiles";
import { pastRides } from "@/data/past-rides";
import { mockUpcomingRides } from "@/data/mock";
import type { Ride } from "@/types";

// ── Storage helpers ──
const GRID_RIDERS_KEY = "t2w_grid_riders";
const GRID_RIDERS_VERSION_KEY = "t2w_grid_riders_version";
const GRID_RIDER_EDITS_KEY = "t2w_grid_rider_edits"; // riderId -> partial RiderProfile overrides
const GRID_PARTICIPATION_KEY = "t2w_grid_participation"; // riderId -> { rideId: points }
const GRID_NEW_RIDERS_KEY = "t2w_grid_new_riders"; // riders added via admin grid
const GRID_DELETED_RIDERS_KEY = "t2w_grid_deleted_riders"; // rider IDs removed from grid

// Current version - bump this to force re-seed when static data changes
const CURRENT_DATA_VERSION = 2;

function getStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function setStorage(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
  // Notify other components
  window.dispatchEvent(
    new CustomEvent("t2w-storage-update", { detail: { key } })
  );
}

// ── Types ──
export interface GridRider extends RiderProfile {
  // Participation as a map: rideId -> points (5, 7.5, 10, or 0 for not participated)
  participationMap: Record<string, number>;
}

// ── Core functions ──

/**
 * Get all riders with their participation data.
 * This merges static data with any admin edits from localStorage.
 */
export function getGridRiders(): GridRider[] {
  // Check if we need to re-seed
  const storedVersion = getStorage<number>(GRID_RIDERS_VERSION_KEY, 0);
  if (storedVersion < CURRENT_DATA_VERSION) {
    // Clear old edits on version bump so fresh Excel data takes effect
    if (typeof window !== "undefined") {
      localStorage.removeItem(GRID_RIDER_EDITS_KEY);
      localStorage.removeItem(GRID_PARTICIPATION_KEY);
      localStorage.removeItem(GRID_NEW_RIDERS_KEY);
      localStorage.removeItem(GRID_DELETED_RIDERS_KEY);
      setStorage(GRID_RIDERS_VERSION_KEY, CURRENT_DATA_VERSION);
    }
  }

  const edits = getStorage<Record<string, Partial<RiderProfile>>>(GRID_RIDER_EDITS_KEY, {});
  const participationOverrides = getStorage<Record<string, Record<string, number>>>(GRID_PARTICIPATION_KEY, {});
  const newRiders = getStorage<GridRider[]>(GRID_NEW_RIDERS_KEY, []);
  const deletedIds = new Set(getStorage<string[]>(GRID_DELETED_RIDERS_KEY, []));

  // Build riders from static data + edits
  const riders: GridRider[] = staticRiderProfiles
    .filter((r) => !deletedIds.has(r.id))
    .map((staticRider) => {
      const riderEdits = edits[staticRider.id] || {};
      const merged = { ...staticRider, ...riderEdits };

      // Build participation map from rides
      const participationMap: Record<string, number> = {};
      for (const rp of staticRider.ridesParticipated) {
        participationMap[rp.rideId] = rp.points ?? 5;
      }
      // Apply overrides from admin
      const overrides = participationOverrides[staticRider.id];
      if (overrides) {
        for (const [rideId, points] of Object.entries(overrides)) {
          if (points > 0) {
            participationMap[rideId] = points;
          } else {
            delete participationMap[rideId];
          }
        }
      }

      // Recalculate derived fields
      const allRides = getAllRidesStatic();
      const ridesParticipated = Object.entries(participationMap).map(
        ([rideId, points]) => {
          const ride = allRides.find((r) => r.id === rideId);
          return {
            rideId,
            rideNumber: ride?.rideNumber || "",
            rideTitle: ride?.title || "",
            rideDate: ride?.startDate || "",
            distanceKm: ride?.distanceKm || 0,
            points,
          };
        }
      );

      return {
        ...merged,
        participationMap,
        ridesParticipated,
        ridesCompleted: ridesParticipated.length,
        totalKm: ridesParticipated.reduce((sum, r) => sum + r.distanceKm, 0),
        totalPoints: ridesParticipated.reduce((sum, r) => sum + r.points, 0),
      };
    });

  // Add new riders created by admin
  for (const newRider of newRiders) {
    if (!deletedIds.has(newRider.id)) {
      const riderEdits = edits[newRider.id] || {};
      const merged = { ...newRider, ...riderEdits };
      const overrides = participationOverrides[newRider.id];
      const participationMap = { ...(newRider.participationMap || {}) };
      if (overrides) {
        for (const [rideId, points] of Object.entries(overrides)) {
          if (points > 0) {
            participationMap[rideId] = points;
          } else {
            delete participationMap[rideId];
          }
        }
      }
      const allRides = getAllRidesStatic();
      const ridesParticipated = Object.entries(participationMap).map(
        ([rideId, points]) => {
          const ride = allRides.find((r) => r.id === rideId);
          return {
            rideId,
            rideNumber: ride?.rideNumber || "",
            rideTitle: ride?.title || "",
            rideDate: ride?.startDate || "",
            distanceKm: ride?.distanceKm || 0,
            points,
          };
        }
      );
      riders.push({
        ...merged,
        participationMap,
        ridesParticipated,
        ridesCompleted: ridesParticipated.length,
        totalKm: ridesParticipated.reduce((sum, r) => sum + r.distanceKm, 0),
        totalPoints: ridesParticipated.reduce((sum, r) => sum + r.points, 0),
      });
    }
  }

  return riders;
}

/**
 * Get a single rider by ID
 */
export function getGridRider(id: string): GridRider | undefined {
  return getGridRiders().find((r) => r.id === id);
}

/**
 * Get a rider by email (for account merging)
 */
export function getGridRiderByEmail(email: string): GridRider | undefined {
  const lower = email.toLowerCase().trim();
  return getGridRiders().find((r) => r.email.toLowerCase().trim() === lower);
}

/**
 * Update rider profile fields (Super Admin edit)
 */
export function updateGridRider(
  riderId: string,
  updates: Partial<RiderProfile>
) {
  const edits = getStorage<Record<string, Partial<RiderProfile>>>(GRID_RIDER_EDITS_KEY, {});
  edits[riderId] = { ...(edits[riderId] || {}), ...updates };
  setStorage(GRID_RIDER_EDITS_KEY, edits);
}

/**
 * Toggle or set participation for a rider in a ride
 * points: 0 = remove, 5/7.5/10 = add with that point value
 */
export function setGridParticipation(
  riderId: string,
  rideId: string,
  points: number
) {
  const overrides = getStorage<Record<string, Record<string, number>>>(GRID_PARTICIPATION_KEY, {});
  if (!overrides[riderId]) overrides[riderId] = {};
  overrides[riderId][rideId] = points;
  setStorage(GRID_PARTICIPATION_KEY, overrides);
}

/**
 * Add a new rider to the grid (Super Admin)
 */
export function addGridRider(rider: Omit<GridRider, "participationMap" | "ridesParticipated" | "ridesCompleted" | "totalKm" | "totalPoints" | "ridesOrganized" | "sweepsDone" | "pilotsDone">): GridRider {
  const newRiders = getStorage<GridRider[]>(GRID_NEW_RIDERS_KEY, []);
  const newRider: GridRider = {
    ...rider,
    participationMap: {},
    ridesParticipated: [],
    ridesCompleted: 0,
    totalKm: 0,
    totalPoints: 0,
    ridesOrganized: 0,
    sweepsDone: 0,
    pilotsDone: 0,
  };
  newRiders.push(newRider);
  setStorage(GRID_NEW_RIDERS_KEY, newRiders);
  return newRider;
}

/**
 * Delete a rider from the grid (Super Admin)
 */
export function deleteGridRider(riderId: string) {
  const deletedIds = getStorage<string[]>(GRID_DELETED_RIDERS_KEY, []);
  if (!deletedIds.includes(riderId)) {
    deletedIds.push(riderId);
    setStorage(GRID_DELETED_RIDERS_KEY, deletedIds);
  }
}

/**
 * Get all rides (static + custom). Used internally.
 */
function getAllRidesStatic(): Ride[] {
  return [...pastRides, ...mockUpcomingRides];
}

/**
 * Get the list of riders for a specific ride (by ride ID)
 * Returns rider names from grid participation data
 */
export function getRidersForRide(rideId: string): string[] {
  const riders = getGridRiders();
  return riders
    .filter((r) => r.participationMap[rideId] && r.participationMap[rideId] > 0)
    .map((r) => r.name);
}

/**
 * Get rider profiles for a specific ride
 */
export function getRiderProfilesForRide(rideId: string): GridRider[] {
  const riders = getGridRiders();
  return riders.filter(
    (r) => r.participationMap[rideId] && r.participationMap[rideId] > 0
  );
}

/**
 * Convert GridRider to the base RiderProfile interface
 */
export function toRiderProfile(gridRider: GridRider): RiderProfile {
  const { participationMap, ...profile } = gridRider;
  void participationMap; // unused but destructured
  return profile;
}

/**
 * Get name->id lookup from grid data
 */
export function getGridRiderNameToId(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const r of getGridRiders()) {
    map[r.name.toLowerCase().trim()] = r.id;
  }
  return map;
}

/**
 * Get email->id lookup from grid data
 */
export function getGridRiderEmailToId(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const r of getGridRiders()) {
    if (r.email) map[r.email.toLowerCase().trim()] = r.id;
  }
  return map;
}
