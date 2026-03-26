import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNextRequest, parseResponse } from '@/__tests__/helpers';

vi.mock('@/lib/db', () => ({
  prisma: {
    riderProfile: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}));

import { POST } from '@/app/api/upload/avatar-sync/route';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

describe('POST /api/upload/avatar-sync', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const req = createNextRequest('http://localhost:3000/api/upload/avatar-sync', {
      method: 'POST',
      body: { riderId: 'r1', avatarDataUrl: 'data:image/png;base64,abc' },
    });
    const res = await POST(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(401);
  });

  it('returns 400 when riderId is missing', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', role: 'superadmin' } as any);

    const req = createNextRequest('http://localhost:3000/api/upload/avatar-sync', {
      method: 'POST',
      body: { avatarDataUrl: 'data:image/png;base64,abc' },
    });
    const res = await POST(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(400);
  });

  it('returns 403 when user is not owner or superadmin', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: 'u1', role: 'rider', linkedRiderId: 'other-rider',
    } as any);

    const req = createNextRequest('http://localhost:3000/api/upload/avatar-sync', {
      method: 'POST',
      body: { riderId: 'r1', avatarDataUrl: 'data:image/png;base64,abc' },
    });
    const res = await POST(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(403);
  });

  it('skips sync when DB already has a valid data URL', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: 'u1', role: 'superadmin', linkedRiderId: null,
    } as any);
    vi.mocked(prisma.riderProfile.findUnique).mockResolvedValue({
      avatarUrl: 'data:image/png;base64,existing',
    } as any);

    const req = createNextRequest('http://localhost:3000/api/upload/avatar-sync', {
      method: 'POST',
      body: { riderId: 'r1', avatarDataUrl: 'data:image/png;base64,new' },
    });
    const res = await POST(req);
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.skipped).toBe(true);
    expect(data.url).toBe('data:image/png;base64,existing');
  });

  it('syncs avatar when DB has filesystem path', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: 'u1', role: 'superadmin', linkedRiderId: null,
    } as any);
    vi.mocked(prisma.riderProfile.findUnique).mockResolvedValue({
      avatarUrl: '/uploads/avatar.jpg',
    } as any);
    vi.mocked(prisma.riderProfile.update).mockResolvedValue({} as any);

    const req = createNextRequest('http://localhost:3000/api/upload/avatar-sync', {
      method: 'POST',
      body: { riderId: 'r1', avatarDataUrl: 'data:image/png;base64,new' },
    });
    const res = await POST(req);
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.synced).toBe(true);
    expect(prisma.riderProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'r1' },
        data: { avatarUrl: 'data:image/png;base64,new' },
      })
    );
  });

  it('syncs avatar when DB has no avatar', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: 'u1', role: 'rider', linkedRiderId: 'r1',
    } as any);
    vi.mocked(prisma.riderProfile.findUnique).mockResolvedValue({
      avatarUrl: null,
    } as any);
    vi.mocked(prisma.riderProfile.update).mockResolvedValue({} as any);

    const req = createNextRequest('http://localhost:3000/api/upload/avatar-sync', {
      method: 'POST',
      body: { riderId: 'r1', avatarDataUrl: 'data:image/png;base64,new' },
    });
    const res = await POST(req);
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.synced).toBe(true);
  });
});
