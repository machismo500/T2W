import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNextRequest, parseResponse, mockSuperAdmin, mockCoreMember, mockRider } from '@/__tests__/helpers';

vi.mock('@/lib/db', () => {
  const mock: Record<string, unknown> = {
    rideParticipation: {
      deleteMany: vi.fn(),
      upsert: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    user: { findMany: vi.fn(), update: vi.fn() },
    rideRegistration: { findMany: vi.fn() },
    ride: { update: vi.fn() },
    $transaction: null,
  };
  mock.$transaction = vi.fn().mockImplementation(async (fn: (p: typeof mock) => unknown) => fn(mock));
  return { prisma: mock };
});

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}));

import { PUT, POST, PATCH } from '@/app/api/riders/participation/route';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

describe('PUT /api/riders/participation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 403 for regular rider', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockRider as any);

    const req = createNextRequest('http://localhost:3000/api/riders/participation', {
      method: 'PUT',
      body: { riderProfileId: 'rp-1', rideId: 'ride-1', points: 5 },
    });
    const res = await PUT(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(403);
  });

  it('returns 403 for unauthenticated users', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const req = createNextRequest('http://localhost:3000/api/riders/participation', {
      method: 'PUT',
      body: { riderProfileId: 'rp-1', rideId: 'ride-1', points: 5 },
    });
    const res = await PUT(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(403);
  });

  it('removes participation when points <= 0', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockSuperAdmin as any);
    vi.mocked(prisma.rideParticipation.deleteMany).mockResolvedValue({ count: 1 } as any);
    vi.mocked(prisma.user.findMany).mockResolvedValue([]); // no linked users
    vi.mocked(prisma.rideRegistration.findMany).mockResolvedValue([]); // no confirmed registrations
    vi.mocked(prisma.rideParticipation.findMany).mockResolvedValue([]); // fallback participations
    vi.mocked(prisma.ride.update).mockResolvedValue({} as any);

    const req = createNextRequest('http://localhost:3000/api/riders/participation', {
      method: 'PUT',
      body: { riderProfileId: 'rp-1', rideId: 'ride-1', points: 0 },
    });
    const res = await PUT(req);
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.action).toBe('removed');
    expect(prisma.rideParticipation.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { riderProfileId: 'rp-1', rideId: 'ride-1' },
      })
    );
  });

  it('upserts participation when points > 0', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockCoreMember as any);
    vi.mocked(prisma.rideParticipation.upsert).mockResolvedValue({} as any);
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: 'u1', role: 'rider' },
    ] as any);
    vi.mocked(prisma.rideParticipation.findMany).mockResolvedValue([
      { ride: { distanceKm: 100 } },
    ] as any);
    vi.mocked(prisma.user.update).mockResolvedValue({} as any);
    vi.mocked(prisma.rideRegistration.findMany).mockResolvedValue([]);
    vi.mocked(prisma.ride.update).mockResolvedValue({} as any);

    const req = createNextRequest('http://localhost:3000/api/riders/participation', {
      method: 'PUT',
      body: { riderProfileId: 'rp-1', rideId: 'ride-1', points: 5 },
    });
    const res = await PUT(req);
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.action).toBe('set');
    expect(data.points).toBe(5);
    expect(prisma.rideParticipation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { riderProfileId_rideId: { riderProfileId: 'rp-1', rideId: 'ride-1' } },
        update: { points: 5 },
        create: { riderProfileId: 'rp-1', rideId: 'ride-1', points: 5 },
      })
    );
  });

  it('syncs user stats after setting participation', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockSuperAdmin as any);
    vi.mocked(prisma.rideParticipation.upsert).mockResolvedValue({} as any);
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: 'u1', role: 'rider' },
    ] as any);
    vi.mocked(prisma.rideParticipation.findMany).mockResolvedValue([
      { ride: { distanceKm: 50 } },
      { ride: { distanceKm: 75 } },
    ] as any);
    vi.mocked(prisma.user.update).mockResolvedValue({} as any);
    vi.mocked(prisma.rideRegistration.findMany).mockResolvedValue([]);
    vi.mocked(prisma.ride.update).mockResolvedValue({} as any);

    const req = createNextRequest('http://localhost:3000/api/riders/participation', {
      method: 'PUT',
      body: { riderProfileId: 'rp-1', rideId: 'ride-1', points: 5 },
    });
    const res = await PUT(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(200);
    // User should be updated with computed stats and auto-upgraded from rider to t2w_rider
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1' },
        data: expect.objectContaining({
          totalKm: 125,
          ridesCompleted: 2,
          role: 't2w_rider',
        }),
      })
    );
  });
});

describe('POST /api/riders/participation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 403 for regular rider', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockRider as any);

    const req = createNextRequest('http://localhost:3000/api/riders/participation', {
      method: 'POST',
      body: { changes: [] },
    });
    const res = await POST(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(403);
  });

  it('returns 400 when changes is not an array', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockSuperAdmin as any);

    const req = createNextRequest('http://localhost:3000/api/riders/participation', {
      method: 'POST',
      body: { changes: 'not-an-array' },
    });
    const res = await POST(req);
    const { status, data } = await parseResponse(res);
    expect(status).toBe(400);
    expect(data.error).toContain('array');
  });

  it('processes bulk changes successfully', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockCoreMember as any);
    vi.mocked(prisma.rideParticipation.upsert).mockResolvedValue({} as any);
    vi.mocked(prisma.rideParticipation.deleteMany).mockResolvedValue({ count: 1 } as any);
    vi.mocked(prisma.user.findMany).mockResolvedValue([]); // no linked users
    vi.mocked(prisma.rideParticipation.findMany).mockResolvedValue([]);
    vi.mocked(prisma.rideRegistration.findMany).mockResolvedValue([]);
    vi.mocked(prisma.ride.update).mockResolvedValue({} as any);

    const changes = [
      { riderProfileId: 'rp-1', rideId: 'ride-1', points: 5 },
      { riderProfileId: 'rp-2', rideId: 'ride-1', points: 0 },
      { riderProfileId: 'rp-1', rideId: 'ride-2', points: 10 },
    ];

    const req = createNextRequest('http://localhost:3000/api/riders/participation', {
      method: 'POST',
      body: { changes },
    });
    const res = await POST(req);
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.processed).toBe(3);
    // points > 0 should upsert, points <= 0 should delete
    expect(prisma.rideParticipation.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.rideParticipation.deleteMany).toHaveBeenCalledTimes(1);
  });
});

describe('PATCH /api/riders/participation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 403 for non-superadmin (core_member should fail)', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockCoreMember as any);

    const req = createNextRequest('http://localhost:3000/api/riders/participation', {
      method: 'PATCH',
      body: { riderProfileId: 'rp-1', rideId: 'ride-1', droppedOut: true },
    });
    const res = await PATCH(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(403);
  });

  it('returns 400 when riderProfileId or rideId missing', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockSuperAdmin as any);

    const req = createNextRequest('http://localhost:3000/api/riders/participation', {
      method: 'PATCH',
      body: { riderProfileId: 'rp-1' },
    });
    const res = await PATCH(req);
    const { status, data } = await parseResponse(res);
    expect(status).toBe(400);
    expect(data.error).toContain('required');
  });

  it('marks rider as dropped out', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockSuperAdmin as any);
    vi.mocked(prisma.rideParticipation.update).mockResolvedValue({} as any);
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: 'u1', role: 't2w_rider' },
    ] as any);
    vi.mocked(prisma.rideParticipation.findMany).mockResolvedValue([
      { ride: { distanceKm: 100 } },
    ] as any);
    vi.mocked(prisma.user.update).mockResolvedValue({} as any);
    vi.mocked(prisma.rideRegistration.findMany).mockResolvedValue([]);
    vi.mocked(prisma.ride.update).mockResolvedValue({} as any);

    const req = createNextRequest('http://localhost:3000/api/riders/participation', {
      method: 'PATCH',
      body: { riderProfileId: 'rp-1', rideId: 'ride-1', droppedOut: true },
    });
    const res = await PATCH(req);
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.droppedOut).toBe(true);
    expect(prisma.rideParticipation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { riderProfileId_rideId: { riderProfileId: 'rp-1', rideId: 'ride-1' } },
        data: { droppedOut: true },
      })
    );
  });

  it('unmarks rider as dropped out', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockSuperAdmin as any);
    vi.mocked(prisma.rideParticipation.update).mockResolvedValue({} as any);
    vi.mocked(prisma.user.findMany).mockResolvedValue([]);
    vi.mocked(prisma.rideParticipation.findMany).mockResolvedValue([]);
    vi.mocked(prisma.rideRegistration.findMany).mockResolvedValue([]);
    vi.mocked(prisma.ride.update).mockResolvedValue({} as any);

    const req = createNextRequest('http://localhost:3000/api/riders/participation', {
      method: 'PATCH',
      body: { riderProfileId: 'rp-1', rideId: 'ride-1', droppedOut: false },
    });
    const res = await PATCH(req);
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.droppedOut).toBe(false);
  });
});
