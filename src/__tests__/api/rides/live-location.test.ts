import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNextRequest, parseResponse } from '@/__tests__/helpers';

vi.mock('@/lib/db', () => ({
  prisma: {
    liveRideSession: { findUnique: vi.fn() },
    liveRideLocation: { create: vi.fn() },
  },
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/lib/geo-utils', () => ({
  isOnRoute: vi.fn().mockReturnValue(true),
}));

import { POST } from '@/app/api/rides/[id]/live/location/route';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { isOnRoute } from '@/lib/geo-utils';

const makeParams = () => ({ params: Promise.resolve({ id: 'ride-1' }) });

describe('POST /api/rides/[id]/live/location', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const req = createNextRequest('http://localhost:3000/api/rides/ride-1/live/location', {
      method: 'POST',
      body: { lat: 12.9, lng: 77.6 },
    });
    const res = await POST(req, makeParams());
    const { status } = await parseResponse(res);
    expect(status).toBe(401);
  });

  it('returns 400 when lat/lng are missing', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1' } as any);

    const req = createNextRequest('http://localhost:3000/api/rides/ride-1/live/location', {
      method: 'POST',
      body: { speed: 50 },
    });
    const res = await POST(req, makeParams());
    const { status, data } = await parseResponse(res);
    expect(status).toBe(400);
    expect(data.error).toContain('lat and lng');
  });

  it('returns 400 when no active session', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1' } as any);
    vi.mocked(prisma.liveRideSession.findUnique).mockResolvedValue(null);

    const req = createNextRequest('http://localhost:3000/api/rides/ride-1/live/location', {
      method: 'POST',
      body: { lat: 12.9, lng: 77.6 },
    });
    const res = await POST(req, makeParams());
    const { status, data } = await parseResponse(res);
    expect(status).toBe(400);
    expect(data.error).toContain('No active');
  });

  it('returns 400 when session is paused', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1' } as any);
    vi.mocked(prisma.liveRideSession.findUnique).mockResolvedValue({
      id: 'sess-1', status: 'paused', plannedRoute: null,
    } as any);

    const req = createNextRequest('http://localhost:3000/api/rides/ride-1/live/location', {
      method: 'POST',
      body: { lat: 12.9, lng: 77.6 },
    });
    const res = await POST(req, makeParams());
    const { status } = await parseResponse(res);
    expect(status).toBe(400);
  });

  it('creates location record for live session', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1' } as any);
    vi.mocked(prisma.liveRideSession.findUnique).mockResolvedValue({
      id: 'sess-1', status: 'live', plannedRoute: null,
    } as any);
    vi.mocked(prisma.liveRideLocation.create).mockResolvedValue({} as any);

    const req = createNextRequest('http://localhost:3000/api/rides/ride-1/live/location', {
      method: 'POST',
      body: { lat: 12.9, lng: 77.6, speed: 60, heading: 180 },
    });
    const res = await POST(req, makeParams());
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.isDeviated).toBe(false);
    expect(prisma.liveRideLocation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sessionId: 'sess-1',
          userId: 'u1',
          lat: 12.9,
          lng: 77.6,
          speed: 60,
          heading: 180,
        }),
      })
    );
  });

  it('checks deviation against planned route', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1' } as any);
    const route = JSON.stringify([{ lat: 12.9, lng: 77.6 }, { lat: 13.0, lng: 77.7 }]);
    vi.mocked(prisma.liveRideSession.findUnique).mockResolvedValue({
      id: 'sess-1', status: 'live', plannedRoute: route,
    } as any);
    vi.mocked(isOnRoute).mockReturnValue(false);
    vi.mocked(prisma.liveRideLocation.create).mockResolvedValue({} as any);

    const req = createNextRequest('http://localhost:3000/api/rides/ride-1/live/location', {
      method: 'POST',
      body: { lat: 14.0, lng: 78.0 },
    });
    const res = await POST(req, makeParams());
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.isDeviated).toBe(true);
    expect(isOnRoute).toHaveBeenCalledWith({ lat: 14.0, lng: 78.0 }, expect.any(Array), 200);
  });
});
