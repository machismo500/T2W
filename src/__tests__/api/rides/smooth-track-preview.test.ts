import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNextRequest, parseResponse, mockSuperAdmin } from '@/__tests__/helpers';
import { DEFAULT_ROLE_PERMISSIONS } from '@/lib/role-permissions';

vi.mock('@/lib/db', () => ({
  prisma: {
    liveRideSession: { findUnique: vi.fn(), update: vi.fn() },
    liveRideLocation: { findMany: vi.fn() },
    liveRideLocationSmoothed: { deleteMany: vi.fn(), createMany: vi.fn() },
    rideMapEdit: { create: vi.fn() },
    $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(prisma)),
  },
}));

vi.mock('@/lib/auth', () => ({ getCurrentUser: vi.fn() }));

vi.mock('@/lib/role-permissions', async () => {
  const mod = await vi.importActual<typeof import('@/lib/role-permissions')>('@/lib/role-permissions');
  return { ...mod, getRolePermissions: vi.fn(async () => mod.DEFAULT_ROLE_PERMISSIONS) };
});

vi.mock('@/lib/roads-api', () => ({
  snapToRoads: vi.fn(async (points: { lat: number; lng: number }[]) =>
    // Return the same points with originalIndex set so each maps 1:1 to a raw point.
    points.map((p, i) => ({ ...p, originalIndex: i }))
  ),
  getRoadDirections: vi.fn(async () => []),
}));

import { POST } from '@/app/api/rides/[id]/live/map-edit/smooth-track/route';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { getRolePermissions } from '@/lib/role-permissions';

const makeParams = () => ({ params: Promise.resolve({ id: 'ride-1' }) });

describe('POST smooth-track ?preview=1', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRolePermissions).mockResolvedValue(DEFAULT_ROLE_PERMISSIONS);
    vi.mocked(prisma.liveRideSession.findUnique).mockResolvedValue({
      id: 'sess-1', status: 'ended',
    } as any);
    vi.mocked(prisma.liveRideLocation.findMany).mockResolvedValue([
      { lat: 12.9, lng: 77.6, speed: null, recordedAt: new Date('2025-01-01T08:00:00Z') },
      { lat: 13.0, lng: 77.7, speed: null, recordedAt: new Date('2025-01-01T08:05:00Z') },
    ] as any);
  });

  it('returns proposed points and does NOT persist when preview=1', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockSuperAdmin as any);

    const req = createNextRequest(
      'http://localhost:3000/api/rides/ride-1/live/map-edit/smooth-track?preview=1',
      { method: 'POST', body: { userId: 'rider-1' } }
    );
    const res = await POST(req, makeParams());
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.preview).toBe(true);
    expect(Array.isArray(data.points)).toBe(true);
    expect(data.points.length).toBeGreaterThan(0);
    // No persistence side-effects in preview mode.
    expect(prisma.liveRideLocationSmoothed.deleteMany).not.toHaveBeenCalled();
    expect(prisma.liveRideLocationSmoothed.createMany).not.toHaveBeenCalled();
    expect(prisma.rideMapEdit.create).not.toHaveBeenCalled();
  });

  it('commits as normal when preview is not set', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockSuperAdmin as any);
    vi.mocked(prisma.liveRideLocationSmoothed.deleteMany).mockResolvedValue({ count: 0 } as any);
    vi.mocked(prisma.liveRideLocationSmoothed.createMany).mockResolvedValue({ count: 2 } as any);
    vi.mocked(prisma.liveRideSession.update).mockResolvedValue({} as any);
    vi.mocked(prisma.rideMapEdit.create).mockResolvedValue({} as any);

    const req = createNextRequest(
      'http://localhost:3000/api/rides/ride-1/live/map-edit/smooth-track',
      { method: 'POST', body: { userId: 'rider-1' } }
    );
    const res = await POST(req, makeParams());
    expect(res.status).toBe(200);
    expect(prisma.liveRideLocationSmoothed.deleteMany).toHaveBeenCalled();
    expect(prisma.liveRideLocationSmoothed.createMany).toHaveBeenCalled();
  });
});
