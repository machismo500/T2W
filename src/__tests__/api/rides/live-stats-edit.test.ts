import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNextRequest, parseResponse, mockSuperAdmin, mockCoreMember, mockRider } from '@/__tests__/helpers';
import { DEFAULT_ROLE_PERMISSIONS } from '@/lib/role-permissions';

vi.mock('@/lib/db', () => ({
  prisma: {
    liveRideSession: { findUnique: vi.fn(), update: vi.fn() },
    rideMapEdit: { create: vi.fn() },
    $transaction: vi.fn(async (cb) => {
      // Pass-through tx with the same mocks
      return cb({
        liveRideSession: prisma.liveRideSession,
        rideMapEdit: prisma.rideMapEdit,
      });
    }),
  },
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/lib/role-permissions', async () => {
  const mod = await vi.importActual<typeof import('@/lib/role-permissions')>('@/lib/role-permissions');
  return {
    ...mod,
    getRolePermissions: vi.fn(async () => mod.DEFAULT_ROLE_PERMISSIONS),
  };
});

import { PATCH } from '@/app/api/rides/[id]/live/map-edit/stats/route';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { getRolePermissions } from '@/lib/role-permissions';

const makeParams = () => ({ params: Promise.resolve({ id: 'ride-1' }) });

const sessionRow = {
  id: 'sess-1',
  status: 'ended',
  distanceKmOverride: null,
  avgSpeedKmhOverride: null,
  maxSpeedKmhOverride: null,
  movingMinutesOverride: null,
  elevationGainM: null,
  elevationLossM: null,
};

describe('PATCH /api/rides/[id]/live/map-edit/stats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.liveRideSession.findUnique).mockResolvedValue(sessionRow as any);
    vi.mocked(prisma.liveRideSession.update).mockResolvedValue({ ...sessionRow } as any);
    vi.mocked(prisma.rideMapEdit.create).mockResolvedValue({} as any);
    vi.mocked(getRolePermissions).mockResolvedValue(DEFAULT_ROLE_PERMISSIONS);
  });

  it('rejects unauthenticated requests', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const req = createNextRequest('http://localhost:3000/api/rides/ride-1/live/map-edit/stats', {
      method: 'PATCH',
      body: { distanceKmOverride: 100 },
    });
    const res = await PATCH(req, makeParams());
    expect(res.status).toBe(401);
  });

  it('rejects a plain rider (403)', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockRider as any);
    const req = createNextRequest('http://localhost:3000/api/rides/ride-1/live/map-edit/stats', {
      method: 'PATCH',
      body: { distanceKmOverride: 100 },
    });
    const res = await PATCH(req, makeParams());
    expect(res.status).toBe(403);
  });

  it('allows super-admin to set an override', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockSuperAdmin as any);
    const updated = { ...sessionRow, distanceKmOverride: 845.3 };
    vi.mocked(prisma.liveRideSession.update).mockResolvedValue(updated as any);

    const req = createNextRequest('http://localhost:3000/api/rides/ride-1/live/map-edit/stats', {
      method: 'PATCH',
      body: { distanceKmOverride: 845.3 },
    });
    const res = await PATCH(req, makeParams());
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.session.distanceKmOverride).toBe(845.3);
    expect(prisma.liveRideSession.update).toHaveBeenCalledWith({
      where: { id: 'sess-1' },
      data: { distanceKmOverride: 845.3 },
    });
    expect(prisma.rideMapEdit.create).toHaveBeenCalled();
  });

  it('allows a core member when canEditRideMap is on (default)', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockCoreMember as any);
    vi.mocked(prisma.liveRideSession.update).mockResolvedValue({
      ...sessionRow,
      elevationGainM: 4200,
    } as any);

    const req = createNextRequest('http://localhost:3000/api/rides/ride-1/live/map-edit/stats', {
      method: 'PATCH',
      body: { elevationGainM: 4200 },
    });
    const res = await PATCH(req, makeParams());
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.session.elevationGainM).toBe(4200);
  });

  it('blocks a core member when canEditRideMap is off', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockCoreMember as any);
    vi.mocked(getRolePermissions).mockResolvedValue({
      ...DEFAULT_ROLE_PERMISSIONS,
      core_member: { ...DEFAULT_ROLE_PERMISSIONS.core_member, canEditRideMap: false },
    });

    const req = createNextRequest('http://localhost:3000/api/rides/ride-1/live/map-edit/stats', {
      method: 'PATCH',
      body: { distanceKmOverride: 100 },
    });
    const res = await PATCH(req, makeParams());
    expect(res.status).toBe(403);
  });

  it('refuses while the session is live (409)', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockSuperAdmin as any);
    vi.mocked(prisma.liveRideSession.findUnique).mockResolvedValue({
      ...sessionRow,
      status: 'live',
    } as any);

    const req = createNextRequest('http://localhost:3000/api/rides/ride-1/live/map-edit/stats', {
      method: 'PATCH',
      body: { distanceKmOverride: 100 },
    });
    const res = await PATCH(req, makeParams());
    expect(res.status).toBe(409);
  });

  it('clears an override when passed null', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockSuperAdmin as any);
    vi.mocked(prisma.liveRideSession.findUnique).mockResolvedValue({
      ...sessionRow,
      distanceKmOverride: 845.3,
    } as any);
    vi.mocked(prisma.liveRideSession.update).mockResolvedValue({
      ...sessionRow,
      distanceKmOverride: null,
    } as any);

    const req = createNextRequest('http://localhost:3000/api/rides/ride-1/live/map-edit/stats', {
      method: 'PATCH',
      body: { distanceKmOverride: null },
    });
    const res = await PATCH(req, makeParams());
    expect(res.status).toBe(200);
    expect(prisma.liveRideSession.update).toHaveBeenCalledWith({
      where: { id: 'sess-1' },
      data: { distanceKmOverride: null },
    });
  });

  it('rejects negative numbers', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockSuperAdmin as any);
    const req = createNextRequest('http://localhost:3000/api/rides/ride-1/live/map-edit/stats', {
      method: 'PATCH',
      body: { distanceKmOverride: -10 },
    });
    const res = await PATCH(req, makeParams());
    const { status, data } = await parseResponse(res);
    expect(status).toBe(400);
    expect(data.error).toContain('non-negative');
  });

  it('returns 400 when body is empty', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockSuperAdmin as any);
    const req = createNextRequest('http://localhost:3000/api/rides/ride-1/live/map-edit/stats', {
      method: 'PATCH',
      body: {},
    });
    const res = await PATCH(req, makeParams());
    expect(res.status).toBe(400);
  });
});
