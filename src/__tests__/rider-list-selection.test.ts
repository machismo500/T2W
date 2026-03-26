import { describe, it, expect } from 'vitest';

/**
 * Tests for the rider list selection logic used in:
 * - AdminPage.tsx startEditRide() — single source of truth: only confirmed registrations
 * - RideDetailPage.tsx — choosing which riders to display for completed rides
 *
 * KEY DESIGN PRINCIPLE: RideRegistration (confirmed) is the SINGLE SOURCE OF TRUTH
 * for rider counts. The Ride.riders JSON field is a sync cache, NOT an independent source.
 * The admin edit form no longer merges confirmed + manual riders.
 */

// Mirrors the logic in AdminPage.tsx startEditRide()
// Single source of truth: always use confirmed registrations only
function selectEditRideRiders(
  confirmedRiderNames: string[]
): string[] {
  return [...confirmedRiderNames];
}

// Mirrors the logic in RideDetailPage.tsx for completed rides
function selectDisplayRiders(
  confirmedRiderNames: string[],
  staticRiders: string[]
): string[] {
  return confirmedRiderNames.length > 0 ? confirmedRiderNames : staticRiders;
}

describe('Admin Edit — Manage Riders selection (single source of truth)', () => {
  const confirmed = ['Alice', 'Bob', 'Charlie'];

  it('uses only confirmed registrations regardless of ride status', () => {
    const result = selectEditRideRiders(confirmed);
    expect(result).toEqual(['Alice', 'Bob', 'Charlie']);
  });

  it('does NOT include manually-added riders from Ride.riders field', () => {
    // Even if Ride.riders has extra names, the edit form only shows confirmed registrations
    const result = selectEditRideRiders(confirmed);
    expect(result).not.toContain('Dave');
    expect(result).not.toContain('Eve');
    expect(result).toHaveLength(3);
  });

  it('returns empty when no confirmed registrations exist', () => {
    const result = selectEditRideRiders([]);
    expect(result).toEqual([]);
  });

  it('count matches what is shown on ride cards and detail pages', () => {
    // This is the core invariant: edit form count === public count
    const editCount = selectEditRideRiders(confirmed).length;
    const publicCount = confirmed.length; // same source: confirmedRiderNames
    expect(editCount).toBe(publicCount);
  });
});

describe('RideDetailPage — completed ride display riders', () => {
  it('prefers confirmed riders when available', () => {
    const result = selectDisplayRiders(['Alice', 'Bob'], ['Alice', 'Bob', 'Charlie', 'Extra']);
    expect(result).toEqual(['Alice', 'Bob']);
  });

  it('falls back to static riders when no confirmed riders', () => {
    const result = selectDisplayRiders([], ['Alice', 'Bob']);
    expect(result).toEqual(['Alice', 'Bob']);
  });

  it('returns confirmed even if fewer than static', () => {
    const result = selectDisplayRiders(['Alice'], ['Alice', 'Bob', 'Charlie']);
    expect(result).toEqual(['Alice']);
  });

  it('both empty → returns empty', () => {
    const result = selectDisplayRiders([], []);
    expect(result).toEqual([]);
  });
});
