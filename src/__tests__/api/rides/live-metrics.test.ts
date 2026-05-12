import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseResponse } from '@/__tests__/helpers';
import { NextRequest } from 'next/server';

vi.mock('@/lib/db', () => ({
  prisma: {
    liveRideSession: { findUnique: vi.fn() },
    liveRideLocation: { findMany: vi.fn(), aggregate: vi.fn() },
    liveRideLocationSmoothed: { findMany: vi.fn() },
  },
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/lib/geo-utils', () => ({
  pathDistanceKm: vi.fn().mockReturnValue(45.678),
}));

import { GET } from '@/app/api/rides/[id]/live/metrics/route';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

const makeReq = () =>
  new NextRequest(new URL('http://localhost:3000/api/rides/ride-1/live/metrics'));
const makeParams = () => ({ params: Promise.resolve({ id: 'ride-1' }) });

describe('GET /api/rides/[id]/live/metrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no smoothed series exists, so the route falls back to raw.
    // Individual tests can override this to assert smoothed-preferred behaviour.
    vi.mocked(prisma.liveRideLocationSmoothed.findMany).mockResolvedValue([] as any);
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const res = await GET(makeReq(), makeParams());
    const { status } = await parseResponse(res);
    expect(status).toBe(401);
  });

  it('returns 404 when no session exists', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1' } as any);
    vi.mocked(prisma.liveRideSession.findUnique).mockResolvedValue(null);

    const res = await GET(makeReq(), makeParams());
    const { status } = await parseResponse(res);
    expect(status).toBe(404);
  });

  it('calculates metrics correctly', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1' } as any);

    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 120 * 60000);
    const breakStart = new Date(now.getTime() - 60 * 60000);
    const breakEnd = new Date(now.getTime() - 30 * 60000);

    vi.mocked(prisma.liveRideSession.findUnique).mockResolvedValue({
      id: 'sess-1',
      rideId: 'ride-1',
      status: 'live',
      startedAt: twoHoursAgo,
      createdAt: twoHoursAgo,
      endedAt: null,
      leadRiderId: 'u1',
      sweepRiderId: 'u2',
      breaks: [{ startedAt: breakStart, endedAt: breakEnd }],
    } as any);

    vi.mocked(prisma.liveRideLocation.findMany)
      .mockResolvedValueOnce([ // lead path
        { lat: 12.9, lng: 77.6 },
        { lat: 13.0, lng: 77.7 },
      ] as any)
      .mockResolvedValueOnce([ // rider count
        { userId: 'u1' }, { userId: 'u2' }, { userId: 'u3' },
      ] as any);

    vi.mocked(prisma.liveRideLocation.aggregate).mockResolvedValue({
      _avg: { speed: 42.5 },
      _max: { speed: 85.0 },
    } as any);

    const res = await GET(makeReq(), makeParams());
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.elapsedMinutes).toBe(120);
    expect(data.breakMinutes).toBe(30);
    expect(data.distanceKm).toBe(45.7); // rounded to 1 decimal
    expect(data.distanceSource).toBe('raw');
    expect(data.avgSpeedKmh).toBe(42.5);
    expect(data.maxSpeedKmh).toBe(85.0);
    expect(data.breakCount).toBe(1);
    expect(data.riderCount).toBe(3);
  });

  it('prefers the smoothed/gap-filled series for distance when one exists', async () => {
    const { pathDistanceKm } = await import('@/lib/geo-utils');
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1' } as any);

    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 120 * 60000);
    vi.mocked(prisma.liveRideSession.findUnique).mockResolvedValue({
      id: 'sess-1',
      rideId: 'ride-1',
      status: 'ended',
      startedAt: twoHoursAgo,
      createdAt: twoHoursAgo,
      endedAt: now,
      leadRiderId: 'u1',
      sweepRiderId: 'u2',
      breaks: [],
    } as any);

    // 2 raw points (sparse, straight-line shortcut across a gap) and 5
    // smoothed/gap-filled points along the actual road segment.
    vi.mocked(prisma.liveRideLocation.findMany)
      .mockResolvedValueOnce([
        { lat: 12.9, lng: 77.6 },
        { lat: 13.5, lng: 78.2 },
      ] as any)
      .mockResolvedValueOnce([{ userId: 'u1' }, { userId: 'u2' }] as any);
    vi.mocked(prisma.liveRideLocationSmoothed.findMany).mockResolvedValue([
      { lat: 12.9, lng: 77.6 },
      { lat: 13.0, lng: 77.7 },
      { lat: 13.2, lng: 77.9 },
      { lat: 13.4, lng: 78.1 },
      { lat: 13.5, lng: 78.2 },
    ] as any);
    vi.mocked(prisma.liveRideLocation.aggregate).mockResolvedValue({
      _avg: { speed: 50 }, _max: { speed: 90 },
    } as any);

    // Tag the smoothed path's distance differently so we can prove which
    // array the route hands to pathDistanceKm.
    vi.mocked(pathDistanceKm).mockImplementation((pts: any[]) =>
      pts.length === 5 ? 78.3 : 45.678
    );

    const res = await GET(makeReq(), makeParams());
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.distanceSource).toBe('smoothed');
    expect(data.distanceKm).toBe(78.3);
    // Speed comes from raw aggregate; smoothed table has no speed.
    expect(data.avgSpeedKmh).toBe(50);
    expect(data.maxSpeedKmh).toBe(90);
  });

  it('falls back to createdAt when startedAt is null', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1' } as any);

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60000);

    vi.mocked(prisma.liveRideSession.findUnique).mockResolvedValue({
      id: 'sess-1', status: 'ended',
      startedAt: null, // missing — should fall back to createdAt
      createdAt: oneHourAgo,
      endedAt: now,
      leadRiderId: null, sweepRiderId: null,
      breaks: [],
    } as any);

    vi.mocked(prisma.liveRideLocation.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.liveRideLocation.aggregate).mockResolvedValue({
      _avg: { speed: null }, _max: { speed: null },
    } as any);

    const res = await GET(makeReq(), makeParams());
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.elapsedMinutes).toBe(60);
  });

  it('excludes still-open breaks from breakMinutes (they are in-progress, not yet accounted)', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1' } as any);

    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 120 * 60000);
    const thirtyMinsAgo = new Date(now.getTime() - 30 * 60000);
    const closedBreakStart = new Date(now.getTime() - 90 * 60000);
    const closedBreakEnd = new Date(now.getTime() - 80 * 60000);

    vi.mocked(prisma.liveRideSession.findUnique).mockResolvedValue({
      id: 'sess-1', status: 'live',
      startedAt: twoHoursAgo, createdAt: twoHoursAgo, endedAt: null,
      leadRiderId: null, sweepRiderId: null,
      breaks: [
        { startedAt: closedBreakStart, endedAt: closedBreakEnd }, // 10 min, closed — counted
        { startedAt: thirtyMinsAgo, endedAt: null },              // 30 min, open — ignored
      ],
    } as any);

    vi.mocked(prisma.liveRideLocation.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.liveRideLocation.aggregate).mockResolvedValue({
      _avg: { speed: null }, _max: { speed: null },
    } as any);

    const res = await GET(makeReq(), makeParams());
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    // Only the closed 10-minute break counts; the open one is excluded so a
    // forgotten-to-close break can't inflate metrics.
    expect(data.breakMinutes).toBe(10);
    expect(data.breakCount).toBe(1);
  });

  it('handles session with no lead rider', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1' } as any);

    const now = new Date();
    vi.mocked(prisma.liveRideSession.findUnique).mockResolvedValue({
      id: 'sess-1', status: 'live',
      startedAt: now, createdAt: now, endedAt: null,
      leadRiderId: null, sweepRiderId: null,
      breaks: [],
    } as any);

    vi.mocked(prisma.liveRideLocation.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.liveRideLocation.aggregate).mockResolvedValue({
      _avg: { speed: null }, _max: { speed: null },
    } as any);

    const res = await GET(makeReq(), makeParams());
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.distanceKm).toBe(0);
    expect(data.avgSpeedKmh).toBe(0);
    expect(data.riderCount).toBe(0);
  });
});
