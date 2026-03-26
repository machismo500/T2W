import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseResponse } from '@/__tests__/helpers';
import { NextRequest } from 'next/server';

vi.mock('@/lib/db', () => ({
  prisma: {
    liveRideSession: { findUnique: vi.fn() },
  },
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}));

import { POST } from '@/app/api/rides/[id]/live/join/route';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

const makeReq = () =>
  new NextRequest(new URL('http://localhost:3000/api/rides/ride-1/live/join'), { method: 'POST' });
const makeParams = () => ({ params: Promise.resolve({ id: 'ride-1' }) });

describe('POST /api/rides/[id]/live/join', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const res = await POST(makeReq(), makeParams());
    const { status } = await parseResponse(res);
    expect(status).toBe(401);
  });

  it('returns 404 when no live session exists', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1' } as any);
    vi.mocked(prisma.liveRideSession.findUnique).mockResolvedValue(null);

    const res = await POST(makeReq(), makeParams());
    const { status, data } = await parseResponse(res);
    expect(status).toBe(404);
    expect(data.error).toContain('No live session');
  });

  it('returns 400 when session has ended', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1' } as any);
    vi.mocked(prisma.liveRideSession.findUnique).mockResolvedValue({
      id: 'sess-1', rideId: 'ride-1', status: 'ended',
      leadRiderId: null, sweepRiderId: null, startedAt: new Date(),
    } as any);

    const res = await POST(makeReq(), makeParams());
    const { status, data } = await parseResponse(res);
    expect(status).toBe(400);
    expect(data.error).toContain('ended');
  });

  it('returns session info with isLead/isSweep flags', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1' } as any);
    vi.mocked(prisma.liveRideSession.findUnique).mockResolvedValue({
      id: 'sess-1', rideId: 'ride-1', status: 'live',
      leadRiderId: 'u1', sweepRiderId: 'u2', startedAt: new Date(),
    } as any);

    const res = await POST(makeReq(), makeParams());
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.isLead).toBe(true);
    expect(data.isSweep).toBe(false);
  });

  it('correctly identifies sweep rider', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u2' } as any);
    vi.mocked(prisma.liveRideSession.findUnique).mockResolvedValue({
      id: 'sess-1', rideId: 'ride-1', status: 'live',
      leadRiderId: 'u1', sweepRiderId: 'u2', startedAt: new Date(),
    } as any);

    const res = await POST(makeReq(), makeParams());
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.isLead).toBe(false);
    expect(data.isSweep).toBe(true);
  });
});
