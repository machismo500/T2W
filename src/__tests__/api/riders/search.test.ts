import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseResponse } from '@/__tests__/helpers';
import { NextRequest } from 'next/server';

vi.mock('@/lib/db', () => ({
  prisma: {
    riderProfile: { findMany: vi.fn() },
  },
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}));

import { GET } from '@/app/api/riders/search/route';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

describe('GET /api/riders/search', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 403 for regular riders', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', role: 'rider' } as any);

    const req = new NextRequest(new URL('http://localhost:3000/api/riders/search?q=test'));
    const res = await GET(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(403);
  });

  it('returns 403 for unauthenticated users', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const req = new NextRequest(new URL('http://localhost:3000/api/riders/search?q=test'));
    const res = await GET(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(403);
  });

  it('returns empty results for empty query', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', role: 'superadmin' } as any);

    const req = new NextRequest(new URL('http://localhost:3000/api/riders/search'));
    const res = await GET(req);
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.results).toEqual([]);
  });

  it('returns matching profiles for admin', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', role: 'superadmin' } as any);
    vi.mocked(prisma.riderProfile.findMany).mockResolvedValue([
      { id: 'r1', name: 'Test Rider', email: 'test@t2w.com', phone: '9876543210' },
    ] as any);

    const req = new NextRequest(new URL('http://localhost:3000/api/riders/search?q=test'));
    const res = await GET(req);
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.results).toHaveLength(1);
    expect(data.results[0].name).toBe('Test Rider');
  });

  it('allows core_member access', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', role: 'core_member' } as any);
    vi.mocked(prisma.riderProfile.findMany).mockResolvedValue([]);

    const req = new NextRequest(new URL('http://localhost:3000/api/riders/search?q=a'));
    const res = await GET(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(200);
  });
});
