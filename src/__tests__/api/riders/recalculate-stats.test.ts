import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseResponse, mockSuperAdmin, mockCoreMember, mockRider } from '@/__tests__/helpers';

vi.mock('@/lib/db', () => {
  const mock: Record<string, unknown> = {
    riderProfile: { findMany: vi.fn(), update: vi.fn() },
    ride: { findMany: vi.fn() },
    $transaction: null,
  };
  mock.$transaction = vi.fn().mockImplementation(async (ops: unknown) => {
    // Handle array form: prisma.$transaction([op1, op2, ...])
    if (Array.isArray(ops)) return Promise.all(ops);
    // Handle callback form
    return (ops as (p: typeof mock) => unknown)(mock);
  });
  return { prisma: mock };
});

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}));

import { POST } from '@/app/api/riders/recalculate-stats/route';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

describe('POST /api/riders/recalculate-stats', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 403 for non-superadmin', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockCoreMember as any);

    const res = await POST();
    const { status } = await parseResponse(res);
    expect(status).toBe(403);
  });

  it('returns 403 for unauthenticated users', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const res = await POST();
    const { status } = await parseResponse(res);
    expect(status).toBe(403);
  });

  it('returns 403 for regular riders', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockRider as any);

    const res = await POST();
    const { status } = await parseResponse(res);
    expect(status).toBe(403);
  });

  it('recalculates pilot/sweep/organized counts from ride data', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockSuperAdmin as any);

    const rides = [
      { id: 'r1', rideNumber: 1, leadRider: 'Alice Smith', sweepRider: 'Bob Jones', organisedBy: 'Alice Smith' },
      { id: 'r2', rideNumber: 2, leadRider: 'Bob Jones', sweepRider: 'Alice Smith', organisedBy: null },
      { id: 'r3', rideNumber: 3, leadRider: 'Alice Smith', sweepRider: null, organisedBy: 'Bob Jones' },
    ];

    const allProfilesWithStats = [
      { id: 'p1', name: 'Alice Smith', pilotsDone: 0, sweepsDone: 0, ridesOrganized: 0 },
      { id: 'p2', name: 'Bob Jones', pilotsDone: 0, sweepsDone: 0, ridesOrganized: 0 },
    ];

    // Single call returns profiles with all needed fields
    vi.mocked(prisma.riderProfile.findMany).mockResolvedValue(allProfilesWithStats as any);
    vi.mocked(prisma.ride.findMany).mockResolvedValue(rides as any);
    vi.mocked(prisma.riderProfile.update).mockResolvedValue({} as any);

    const res = await POST();
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.totalRides).toBe(3);
    expect(data.profilesUpdated).toBe(2);

    // Alice: 2 pilots, 1 sweep, 1 organized
    expect(prisma.riderProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'p1' },
        data: { pilotsDone: 2, sweepsDone: 1, ridesOrganized: 1 },
      })
    );
    // Bob: 1 pilot, 1 sweep, 1 organized
    expect(prisma.riderProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'p2' },
        data: { pilotsDone: 1, sweepsDone: 1, ridesOrganized: 1 },
      })
    );
  });

  it('reports unmatched names', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockSuperAdmin as any);

    const rides = [
      { id: 'r1', rideNumber: 1, leadRider: 'Unknown Rider', sweepRider: 'Alice Smith', organisedBy: null },
    ];

    const allProfilesWithStats = [
      { id: 'p1', name: 'Alice Smith', pilotsDone: 0, sweepsDone: 0, ridesOrganized: 0 },
    ];

    vi.mocked(prisma.riderProfile.findMany).mockResolvedValue(allProfilesWithStats as any);
    vi.mocked(prisma.ride.findMany).mockResolvedValue(rides as any);
    vi.mocked(prisma.riderProfile.update).mockResolvedValue({} as any);

    const res = await POST();
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.unmatchedNames).toContain('Lead: Unknown Rider (1)');
  });

  it('handles no changes needed', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockSuperAdmin as any);

    const rides = [
      { id: 'r1', rideNumber: 1, leadRider: 'Alice Smith', sweepRider: null, organisedBy: null },
    ];

    const allProfilesWithStats = [
      { id: 'p1', name: 'Alice Smith', pilotsDone: 1, sweepsDone: 0, ridesOrganized: 0 },
    ];

    vi.mocked(prisma.riderProfile.findMany).mockResolvedValue(allProfilesWithStats as any);
    vi.mocked(prisma.ride.findMany).mockResolvedValue(rides as any);

    const res = await POST();
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.profilesUpdated).toBe(0);
    expect(data.changes).toEqual([]);
    expect(prisma.riderProfile.update).not.toHaveBeenCalled();
  });
});
