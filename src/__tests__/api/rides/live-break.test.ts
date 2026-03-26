import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNextRequest, parseResponse } from '@/__tests__/helpers';

vi.mock('@/lib/db', () => ({
  prisma: {
    liveRideSession: { findUnique: vi.fn(), update: vi.fn() },
    liveRideBreak: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  },
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}));

import { POST } from '@/app/api/rides/[id]/live/break/route';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

const makeParams = () => ({ params: Promise.resolve({ id: 'ride-1' }) });

describe('POST /api/rides/[id]/live/break', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 403 when not authenticated', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const req = createNextRequest('http://localhost:3000/api/rides/ride-1/live/break', {
      method: 'POST',
      body: { action: 'start' },
    });
    const res = await POST(req, makeParams());
    const { status } = await parseResponse(res);
    expect(status).toBe(403);
  });

  it('returns 403 for regular riders', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', role: 'rider' } as any);

    const req = createNextRequest('http://localhost:3000/api/rides/ride-1/live/break', {
      method: 'POST',
      body: { action: 'start' },
    });
    const res = await POST(req, makeParams());
    const { status } = await parseResponse(res);
    expect(status).toBe(403);
  });

  it('returns 400 when no active session', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', role: 'superadmin' } as any);
    vi.mocked(prisma.liveRideSession.findUnique).mockResolvedValue(null);

    const req = createNextRequest('http://localhost:3000/api/rides/ride-1/live/break', {
      method: 'POST',
      body: { action: 'start' },
    });
    const res = await POST(req, makeParams());
    const { status } = await parseResponse(res);
    expect(status).toBe(400);
  });

  it('starts a break and pauses session', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', role: 'core_member' } as any);
    vi.mocked(prisma.liveRideSession.findUnique).mockResolvedValue({
      id: 'sess-1', status: 'live',
    } as any);
    vi.mocked(prisma.liveRideBreak.create).mockResolvedValue({
      id: 'break-1', startedAt: new Date('2024-06-01T10:00:00Z'), reason: 'Fuel stop',
    } as any);
    vi.mocked(prisma.liveRideSession.update).mockResolvedValue({} as any);

    const req = createNextRequest('http://localhost:3000/api/rides/ride-1/live/break', {
      method: 'POST',
      body: { action: 'start', reason: 'Fuel stop' },
    });
    const res = await POST(req, makeParams());
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.break.reason).toBe('Fuel stop');
    expect(prisma.liveRideSession.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'paused' } })
    );
  });

  it('ends a break and resumes session', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', role: 'superadmin' } as any);
    vi.mocked(prisma.liveRideSession.findUnique).mockResolvedValue({
      id: 'sess-1', status: 'paused',
    } as any);
    vi.mocked(prisma.liveRideBreak.findFirst).mockResolvedValue({
      id: 'break-1', startedAt: new Date(), endedAt: null,
    } as any);
    vi.mocked(prisma.liveRideBreak.update).mockResolvedValue({
      id: 'break-1', startedAt: new Date(), endedAt: new Date(), reason: null,
    } as any);
    vi.mocked(prisma.liveRideSession.update).mockResolvedValue({} as any);

    const req = createNextRequest('http://localhost:3000/api/rides/ride-1/live/break', {
      method: 'POST',
      body: { action: 'end' },
    });
    const res = await POST(req, makeParams());
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(prisma.liveRideSession.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'live' } })
    );
  });

  it('returns 400 when ending break but no active break exists', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', role: 'superadmin' } as any);
    vi.mocked(prisma.liveRideSession.findUnique).mockResolvedValue({
      id: 'sess-1', status: 'paused',
    } as any);
    vi.mocked(prisma.liveRideBreak.findFirst).mockResolvedValue(null);

    const req = createNextRequest('http://localhost:3000/api/rides/ride-1/live/break', {
      method: 'POST',
      body: { action: 'end' },
    });
    const res = await POST(req, makeParams());
    const { status, data } = await parseResponse(res);
    expect(status).toBe(400);
    expect(data.error).toContain('No active break');
  });

  it('returns 400 for invalid action', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', role: 'superadmin' } as any);
    vi.mocked(prisma.liveRideSession.findUnique).mockResolvedValue({
      id: 'sess-1', status: 'live',
    } as any);

    const req = createNextRequest('http://localhost:3000/api/rides/ride-1/live/break', {
      method: 'POST',
      body: { action: 'invalid' },
    });
    const res = await POST(req, makeParams());
    const { status, data } = await parseResponse(res);
    expect(status).toBe(400);
    expect(data.error).toContain('Invalid action');
  });
});
