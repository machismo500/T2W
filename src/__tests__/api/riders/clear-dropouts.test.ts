import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseResponse, mockSuperAdmin, mockCoreMember, mockRider } from '@/__tests__/helpers';

vi.mock('@/lib/db', () => ({
  prisma: {
    rideParticipation: {
      count: vi.fn(),
      groupBy: vi.fn(),
      updateMany: vi.fn(),
      findMany: vi.fn(),
    },
    ride: { findMany: vi.fn() },
    user: { findMany: vi.fn(), update: vi.fn() },
  },
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}));

import { GET, POST } from '@/app/api/riders/clear-dropouts/route';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

describe('GET /api/riders/clear-dropouts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 403 for non-superadmin', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockCoreMember as any);

    const res = await GET();
    const { status } = await parseResponse(res);
    expect(status).toBe(403);
  });

  it('returns 403 for unauthenticated users', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const res = await GET();
    const { status } = await parseResponse(res);
    expect(status).toBe(403);
  });

  it('returns 403 for regular riders', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockRider as any);

    const res = await GET();
    const { status } = await parseResponse(res);
    expect(status).toBe(403);
  });

  it('returns dropout statistics with ride breakdown', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockSuperAdmin as any);
    vi.mocked(prisma.rideParticipation.count)
      .mockResolvedValueOnce(50)   // total
      .mockResolvedValueOnce(5);   // dropped
    vi.mocked(prisma.rideParticipation.groupBy).mockResolvedValue([
      { rideId: 'ride-1', _count: 3 },
      { rideId: 'ride-2', _count: 2 },
    ] as any);
    vi.mocked(prisma.ride.findMany).mockResolvedValue([
      { id: 'ride-1', title: 'Ride One', rideNumber: 1 },
      { id: 'ride-2', title: 'Ride Two', rideNumber: 2 },
    ] as any);

    const res = await GET();
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.total).toBe(50);
    expect(data.droppedOut).toBe(5);
    expect(data.byRide).toHaveLength(2);
    expect(data.byRide[0].rideId).toBe('ride-1');
    expect(data.byRide[0].droppedCount).toBe(3);
    expect(data.byRide[0].rideTitle).toBe('Ride One');
  });
});

describe('POST /api/riders/clear-dropouts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 403 for non-superadmin', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockCoreMember as any);

    const res = await POST();
    const { status } = await parseResponse(res);
    expect(status).toBe(403);
  });

  it('clears dropout flags and returns count', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockSuperAdmin as any);
    vi.mocked(prisma.rideParticipation.count).mockResolvedValue(3);
    vi.mocked(prisma.rideParticipation.updateMany).mockResolvedValue({ count: 3 } as any);
    vi.mocked(prisma.rideParticipation.findMany)
      .mockResolvedValueOnce([{ riderProfileId: 'rp-1' }] as any) // distinct
      .mockResolvedValueOnce([{ ride: { distanceKm: 100 } }] as any); // participations for rp-1
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: 'u1', role: 'rider' },
    ] as any);
    vi.mocked(prisma.user.update).mockResolvedValue({} as any);

    const res = await POST();
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.clearedCount).toBe(3);
    expect(data.previousDroppedCount).toBe(3);
    expect(prisma.rideParticipation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { droppedOut: true },
        data: { droppedOut: false },
      })
    );
  });

  it('recalculates user stats after clearing', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockSuperAdmin as any);
    vi.mocked(prisma.rideParticipation.count).mockResolvedValue(2);
    vi.mocked(prisma.rideParticipation.updateMany).mockResolvedValue({ count: 2 } as any);
    vi.mocked(prisma.rideParticipation.findMany)
      .mockResolvedValueOnce([{ riderProfileId: 'rp-1' }] as any) // distinct
      .mockResolvedValueOnce([
        { ride: { distanceKm: 50 } },
        { ride: { distanceKm: 75 } },
      ] as any); // participations
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: 'u1', role: 't2w_rider' },
    ] as any);
    vi.mocked(prisma.user.update).mockResolvedValue({} as any);

    const res = await POST();
    const { status } = await parseResponse(res);
    expect(status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1' },
        data: expect.objectContaining({
          totalKm: 125,
          ridesCompleted: 2,
        }),
      })
    );
  });
});
