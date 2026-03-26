import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseResponse } from '@/__tests__/helpers';
import { NextRequest } from 'next/server';

vi.mock('@/lib/db', () => ({
  prisma: {
    user: { update: vi.fn(), delete: vi.fn() },
  },
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}));

import { PUT as ApprovePUT } from '@/app/api/users/[id]/approve/route';
import { PUT as RejectPUT } from '@/app/api/users/[id]/reject/route';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

const makeReq = () => new NextRequest(new URL('http://localhost:3000/api/users/u2/approve'), { method: 'PUT' });
const makeParams = () => ({ params: Promise.resolve({ id: 'u2' }) });

describe('PUT /api/users/[id]/approve', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 403 for regular riders', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', role: 'rider' } as any);

    const res = await ApprovePUT(makeReq(), makeParams());
    const { status } = await parseResponse(res);
    expect(status).toBe(403);
  });

  it('returns 403 for unauthenticated users', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const res = await ApprovePUT(makeReq(), makeParams());
    const { status } = await parseResponse(res);
    expect(status).toBe(403);
  });

  it('approves user as superadmin', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', role: 'superadmin' } as any);
    vi.mocked(prisma.user.update).mockResolvedValue({} as any);

    const res = await ApprovePUT(makeReq(), makeParams());
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.id).toBe('u2');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u2' },
        data: { isApproved: true },
      })
    );
  });

  it('approves user as core_member', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', role: 'core_member' } as any);
    vi.mocked(prisma.user.update).mockResolvedValue({} as any);

    const res = await ApprovePUT(makeReq(), makeParams());
    const { status } = await parseResponse(res);
    expect(status).toBe(200);
  });
});

describe('PUT /api/users/[id]/reject', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 403 for regular riders', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', role: 'rider' } as any);

    const res = await RejectPUT(makeReq(), makeParams());
    const { status } = await parseResponse(res);
    expect(status).toBe(403);
  });

  it('deletes user on reject as superadmin', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', role: 'superadmin' } as any);
    vi.mocked(prisma.user.delete).mockResolvedValue({} as any);

    const res = await RejectPUT(makeReq(), makeParams());
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.id).toBe('u2');
    expect(prisma.user.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'u2' } })
    );
  });

  it('allows core_member to reject', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', role: 'core_member' } as any);
    vi.mocked(prisma.user.delete).mockResolvedValue({} as any);

    const res = await RejectPUT(makeReq(), makeParams());
    const { status } = await parseResponse(res);
    expect(status).toBe(200);
  });
});
