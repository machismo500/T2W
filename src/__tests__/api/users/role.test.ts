import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNextRequest, parseResponse } from '@/__tests__/helpers';

vi.mock('@/lib/db', () => ({
  prisma: {
    user: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    riderProfile: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  },
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}));

import { PUT } from '@/app/api/users/role/route';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

describe('PUT /api/users/role', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 403 for non-superadmin', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', role: 'core_member' } as any);

    const req = createNextRequest('http://localhost:3000/api/users/role', {
      method: 'PUT',
      body: { userId: 'u2', newRole: 'rider' },
    });
    const res = await PUT(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(403);
  });

  it('returns 400 for missing parameters', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', role: 'superadmin' } as any);

    const req = createNextRequest('http://localhost:3000/api/users/role', {
      method: 'PUT',
      body: { newRole: 'rider' },
    });
    const res = await PUT(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(400);
  });

  it('returns 400 for invalid role', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', role: 'superadmin' } as any);

    const req = createNextRequest('http://localhost:3000/api/users/role', {
      method: 'PUT',
      body: { userId: 'u2', newRole: 'invalid_role' },
    });
    const res = await PUT(req);
    const { status, data } = await parseResponse(res);
    expect(status).toBe(400);
    expect(data.error).toContain('Invalid role');
  });

  it('updates user role by userId', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', role: 'superadmin' } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'u2', linkedRiderId: 'r2',
    } as any);
    vi.mocked(prisma.user.update).mockResolvedValue({} as any);
    vi.mocked(prisma.riderProfile.update).mockResolvedValue({} as any);

    const req = createNextRequest('http://localhost:3000/api/users/role', {
      method: 'PUT',
      body: { userId: 'u2', newRole: 'core_member' },
    });
    const res = await PUT(req);
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.role).toBe('core_member');
    expect(data.updatedUser).toBe(true);
    expect(data.updatedRider).toBe(true);
  });

  it('returns 404 when no user or rider found', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', role: 'superadmin' } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.riderProfile.findUnique).mockResolvedValue(null);

    const req = createNextRequest('http://localhost:3000/api/users/role', {
      method: 'PUT',
      body: { userId: 'nonexistent', newRole: 'rider' },
    });
    const res = await PUT(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(404);
  });

  it('updates rider profile by email when no user account', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', role: 'superadmin' } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.riderProfile.findMany).mockResolvedValue([{
      id: 'r1', email: 'rider@t2w.com',
    }] as any);
    vi.mocked(prisma.riderProfile.update).mockResolvedValue({} as any);

    const req = createNextRequest('http://localhost:3000/api/users/role', {
      method: 'PUT',
      body: { email: 'rider@t2w.com', newRole: 't2w_rider' },
    });
    const res = await PUT(req);
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.updatedRider).toBe(true);
  });
});
