import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNextRequest, parseResponse } from '@/__tests__/helpers';

vi.mock('@/lib/db', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    riderProfile: { findFirst: vi.fn() },
  },
}));

import { POST } from '@/app/api/riders/check-email/route';
import { prisma } from '@/lib/db';

describe('POST /api/riders/check-email', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 when email is missing', async () => {
    const req = createNextRequest('http://localhost:3000/api/riders/check-email', {
      method: 'POST',
      body: {},
    });
    const res = await POST(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(400);
  });

  it('returns both account and rider profile info', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'u1', name: 'Test User',
    } as any);
    vi.mocked(prisma.riderProfile.findFirst).mockResolvedValue({
      id: 'r1', name: 'Test Rider',
    } as any);

    const req = createNextRequest('http://localhost:3000/api/riders/check-email', {
      method: 'POST',
      body: { email: 'test@example.com' },
    });
    const res = await POST(req);
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.hasAccount).toBe(true);
    expect(data.hasRiderProfile).toBe(true);
    expect(data.userName).toBe('Test User');
    expect(data.riderProfileName).toBe('Test Rider');
  });

  it('returns false when no account or profile exists', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.riderProfile.findFirst).mockResolvedValue(null);

    const req = createNextRequest('http://localhost:3000/api/riders/check-email', {
      method: 'POST',
      body: { email: 'nobody@example.com' },
    });
    const res = await POST(req);
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.hasAccount).toBe(false);
    expect(data.hasRiderProfile).toBe(false);
    expect(data.userName).toBe(null);
    expect(data.riderProfileName).toBe(null);
  });

  it('normalizes email to lowercase', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.riderProfile.findFirst).mockResolvedValue(null);

    const req = createNextRequest('http://localhost:3000/api/riders/check-email', {
      method: 'POST',
      body: { email: 'TEST@Example.COM' },
    });
    await POST(req);

    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'test@example.com' } })
    );
  });
});
