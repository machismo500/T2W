import { describe, it, expect } from 'vitest';

/**
 * Tests for the rider list selection logic used in:
 * - AdminPage.tsx startEditRide() — choosing which riders to show in Manage Riders
 * - RideDetailPage.tsx — choosing which riders to display for completed rides
 */

// Mirrors the logic in AdminPage.tsx startEditRide()
function selectEditRideRiders(
  status: string,
  confirmedRiderNames: string[],
  manualRiders: string[]
): string[] {
  if (status === 'completed' && confirmedRiderNames.length > 0) {
    return confirmedRiderNames;
  }
  // Merge: confirmed registrations + any manually-added riders not in registrations
  const mergedRiders = [...confirmedRiderNames];
  for (const name of manualRiders) {
    if (!mergedRiders.includes(name)) mergedRiders.push(name);
  }
  return mergedRiders;
}

// Mirrors the logic in RideDetailPage.tsx for completed rides
function selectDisplayRiders(
  confirmedRiderNames: string[],
  staticRiders: string[]
): string[] {
  return confirmedRiderNames.length > 0 ? confirmedRiderNames : staticRiders;
}

describe('Admin Edit — Manage Riders selection (startEditRide)', () => {
  const confirmed = ['Alice', 'Bob', 'Charlie'];
  const manual = ['Alice', 'Bob', 'Dave', 'Eve']; // Dave & Eve are manual-only

  it('completed ride with confirmed riders → only confirmed riders', () => {
    const result = selectEditRideRiders('completed', confirmed, manual);
    expect(result).toEqual(['Alice', 'Bob', 'Charlie']);
    expect(result).not.toContain('Dave');
    expect(result).not.toContain('Eve');
  });

  it('completed ride with no confirmed riders → falls back to manual riders', () => {
    const result = selectEditRideRiders('completed', [], manual);
    expect(result).toEqual(manual);
  });

  it('upcoming ride → merges confirmed + unique manual riders', () => {
    const result = selectEditRideRiders('upcoming', confirmed, manual);
    expect(result).toEqual(['Alice', 'Bob', 'Charlie', 'Dave', 'Eve']);
  });

  it('upcoming ride with no confirmed riders → returns manual riders', () => {
    const result = selectEditRideRiders('upcoming', [], manual);
    expect(result).toEqual(manual);
  });

  it('upcoming ride with no manual riders → returns confirmed riders', () => {
    const result = selectEditRideRiders('upcoming', confirmed, []);
    expect(result).toEqual(confirmed);
  });

  it('both empty → returns empty', () => {
    const result = selectEditRideRiders('completed', [], []);
    expect(result).toEqual([]);
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
