import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNextRequest } from '@/__tests__/helpers';

vi.mock('@/lib/db', () => ({
  prisma: {
    ride: {
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}));

import { PUT, DELETE } from '@/app/api/rides/[id]/route';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

const mockGetCurrentUser = getCurrentUser as ReturnType<typeof vi.fn>;
const mockUpdate = prisma.ride.update as ReturnType<typeof vi.fn>;
const mockDelete = prisma.ride.delete as ReturnType<typeof vi.fn>;

const SUPERADMIN = { id: 'admin-1', role: 'superadmin' };
const CORE_MEMBER = { id: 'core-1', role: 'core_member' };
const RIDER = { id: 'rider-1', role: 'rider' };

function callPUT(rideId: string, body: Record<string, unknown>) {
  const req = createNextRequest(`http://localhost:3000/api/rides/${rideId}`, {
    method: 'PUT',
    body,
    headers: { 'Content-Type': 'application/json' },
  });
  return PUT(req, { params: Promise.resolve({ id: rideId }) });
}

function callDELETE(rideId: string) {
  const req = createNextRequest(`http://localhost:3000/api/rides/${rideId}`, {
    method: 'DELETE',
  });
  return DELETE(req, { params: Promise.resolve({ id: rideId }) });
}

// ── PUT /api/rides/[id] ────────────────────────────────────────────────────

describe('PUT /api/rides/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockResolvedValue({ id: 'ride-1', title: 'Updated Ride' });
  });

  it('returns 403 when unauthenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await callPUT('ride-1', { title: 'New' });
    expect(res.status).toBe(403);
  });

  it('returns 403 when caller is a plain rider', async () => {
    mockGetCurrentUser.mockResolvedValue(RIDER);
    const res = await callPUT('ride-1', { title: 'New' });
    expect(res.status).toBe(403);
  });

  it('allows superadmin to update allowed fields', async () => {
    mockGetCurrentUser.mockResolvedValue(SUPERADMIN);
    const res = await callPUT('ride-1', { title: 'Updated Ride', status: 'ongoing' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ride).toBeDefined();
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ride-1' },
        data: expect.objectContaining({ title: 'Updated Ride', status: 'ongoing' }),
      })
    );
  });

  it('allows core_member to update allowed fields', async () => {
    mockGetCurrentUser.mockResolvedValue(CORE_MEMBER);
    const res = await callPUT('ride-1', { difficulty: 'hard' });
    expect(res.status).toBe(200);
  });

  it('ignores unknown fields (mass-assignment protection)', async () => {
    mockGetCurrentUser.mockResolvedValue(SUPERADMIN);
    await callPUT('ride-1', { title: 'X', __proto__: 'hack', malicious: true });
    const call = mockUpdate.mock.calls[0][0];
    expect(call.data).not.toHaveProperty('malicious');
    expect(call.data).not.toHaveProperty('__proto__');
  });

  it('converts startDate string to Date object', async () => {
    mockGetCurrentUser.mockResolvedValue(SUPERADMIN);
    await callPUT('ride-1', { startDate: '2025-12-01' });
    const call = mockUpdate.mock.calls[0][0];
    expect(call.data.startDate).toBeInstanceOf(Date);
  });

  it('core_member cannot update regFormSettings — returns 403', async () => {
    mockGetCurrentUser.mockResolvedValue(CORE_MEMBER);
    const res = await callPUT('ride-1', { regFormSettings: { fields: [] } });
    expect(res.status).toBe(403);
  });

  it('superadmin can update regFormSettings', async () => {
    mockGetCurrentUser.mockResolvedValue(SUPERADMIN);
    const settings = { fields: ['name', 'phone'] };
    const res = await callPUT('ride-1', { regFormSettings: settings });
    expect(res.status).toBe(200);
    const call = mockUpdate.mock.calls[0][0];
    expect(call.data.regFormSettings).toBe(JSON.stringify(settings));
  });

  it('returns 500 when DB update throws', async () => {
    mockGetCurrentUser.mockResolvedValue(SUPERADMIN);
    mockUpdate.mockRejectedValue(new Error('DB error'));
    const res = await callPUT('ride-1', { title: 'X' });
    expect(res.status).toBe(500);
  });
});

// ── DELETE /api/rides/[id] ─────────────────────────────────────────────────

describe('DELETE /api/rides/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDelete.mockResolvedValue({ id: 'ride-1' });
  });

  it('returns 403 when unauthenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await callDELETE('ride-1');
    expect(res.status).toBe(403);
  });

  it('returns 403 when caller is core_member (not superadmin)', async () => {
    mockGetCurrentUser.mockResolvedValue(CORE_MEMBER);
    const res = await callDELETE('ride-1');
    expect(res.status).toBe(403);
  });

  it('returns 403 when caller is a plain rider', async () => {
    mockGetCurrentUser.mockResolvedValue(RIDER);
    const res = await callDELETE('ride-1');
    expect(res.status).toBe(403);
  });

  it('allows superadmin to delete a ride', async () => {
    mockGetCurrentUser.mockResolvedValue(SUPERADMIN);
    const res = await callDELETE('ride-1');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: 'ride-1' } });
  });

  it('returns 500 when DB delete throws', async () => {
    mockGetCurrentUser.mockResolvedValue(SUPERADMIN);
    mockDelete.mockRejectedValue(new Error('DB error'));
    const res = await callDELETE('ride-1');
    expect(res.status).toBe(500);
  });
});
