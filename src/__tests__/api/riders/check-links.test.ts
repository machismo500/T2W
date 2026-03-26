import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNextRequest, parseResponse, mockSuperAdmin, mockCoreMember, mockRider } from '@/__tests__/helpers';

vi.mock('@/lib/db', () => ({
  prisma: {
    user: { findMany: vi.fn(), count: vi.fn(), update: vi.fn() },
    riderProfile: { findMany: vi.fn(), count: vi.fn() },
    rideParticipation: { findMany: vi.fn() },
  },
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}));

import { GET, POST } from '@/app/api/riders/check-links/route';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

describe('GET /api/riders/check-links', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 403 for unauthenticated users', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const res = await GET();
    const { status } = await parseResponse(res);
    expect(status).toBe(403);
  });

  it('returns 403 for regular riders', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockRider as any);

    const res = await GET();
    const { status } = await parseResponse(res);
    expect(status).toBe(403);
  });

  it('returns link status report for superadmin', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockSuperAdmin as any);
    vi.mocked(prisma.user.findMany).mockResolvedValue([]);
    vi.mocked(prisma.riderProfile.findMany).mockResolvedValue([]);
    vi.mocked(prisma.user.count).mockResolvedValue(10);
    vi.mocked(prisma.riderProfile.count).mockResolvedValue(8);

    const res = await GET();
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.summary).toBeDefined();
    expect(data.summary.totalUsers).toBe(10);
    expect(data.summary.totalProfiles).toBe(8);
    expect(data.summary.unlinkedUsers).toBe(0);
    expect(data.summary.unlinkedProfiles).toBe(0);
  });

  it('returns link status report for core_member', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockCoreMember as any);
    vi.mocked(prisma.user.findMany).mockResolvedValue([]);
    vi.mocked(prisma.riderProfile.findMany).mockResolvedValue([]);
    vi.mocked(prisma.user.count).mockResolvedValue(5);
    vi.mocked(prisma.riderProfile.count).mockResolvedValue(5);

    const res = await GET();
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.summary).toBeDefined();
  });

  it('correctly categorizes email matches, name matches, and no matches', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockSuperAdmin as any);

    const unlinkedUsers = [
      { id: 'u1', name: 'Alice', email: 'alice@test.com', role: 'rider' },
      { id: 'u2', name: 'Bob', email: 'bob@other.com', role: 'rider' },
      { id: 'u3', name: 'Charlie', email: 'charlie@none.com', role: 'rider' },
    ];
    const unlinkedProfiles = [
      { id: 'p1', name: 'Alice P', email: 'alice@test.com', role: 'rider' },
      { id: 'p2', name: 'Bob', email: 'bob@different.com', role: 'rider' },
      { id: 'p3', name: 'David', email: 'david@test.com', role: 'rider' },
    ];

    vi.mocked(prisma.user.findMany).mockResolvedValue(unlinkedUsers as any);
    vi.mocked(prisma.riderProfile.findMany).mockResolvedValue(unlinkedProfiles as any);
    vi.mocked(prisma.user.count).mockResolvedValue(10);
    vi.mocked(prisma.riderProfile.count).mockResolvedValue(8);

    const res = await GET();
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    // Alice matches by email
    expect(data.matchableByEmail).toHaveLength(1);
    expect(data.matchableByEmail[0].user.id).toBe('u1');
    // Bob matches by name (no email match)
    expect(data.matchableByName).toHaveLength(1);
    expect(data.matchableByName[0].user.id).toBe('u2');
    // Charlie has no match
    expect(data.noMatch).toHaveLength(1);
    expect(data.noMatch[0].id).toBe('u3');
  });
});

describe('POST /api/riders/check-links', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 403 for non-superadmin (core_member should fail)', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockCoreMember as any);

    const req = createNextRequest('http://localhost:3000/api/riders/check-links', {
      method: 'POST',
    });
    const res = await POST(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(403);
  });

  it('auto-links users to profiles by email match', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockSuperAdmin as any);

    const unlinkedUsers = [
      { id: 'u1', name: 'Alice', email: 'alice@test.com' },
    ];
    const unlinkedProfiles = [
      { id: 'p1', name: 'Alice Profile', email: 'alice@test.com' },
    ];

    vi.mocked(prisma.user.findMany).mockResolvedValue(unlinkedUsers as any);
    vi.mocked(prisma.riderProfile.findMany).mockResolvedValue(unlinkedProfiles as any);
    vi.mocked(prisma.user.update).mockResolvedValue({} as any);
    vi.mocked(prisma.rideParticipation.findMany).mockResolvedValue([
      { ride: { distanceKm: 100 } },
    ] as any);

    const req = createNextRequest('http://localhost:3000/api/riders/check-links', {
      method: 'POST',
    });
    const res = await POST(req);
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.linkedByEmail).toBe(1);
    expect(data.totalLinked).toBe(1);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1' },
        data: { linkedRiderId: 'p1' },
      })
    );
  });

  it('includes name matches when ?includeNameMatches=true', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockSuperAdmin as any);

    const unlinkedUsers = [
      { id: 'u1', name: 'Bob', email: 'bob@other.com' },
    ];
    const unlinkedProfiles = [
      { id: 'p1', name: 'Bob', email: 'bob@different.com' },
    ];

    vi.mocked(prisma.user.findMany).mockResolvedValue(unlinkedUsers as any);
    vi.mocked(prisma.riderProfile.findMany).mockResolvedValue(unlinkedProfiles as any);
    vi.mocked(prisma.user.update).mockResolvedValue({} as any);
    vi.mocked(prisma.rideParticipation.findMany).mockResolvedValue([]);

    const req = createNextRequest('http://localhost:3000/api/riders/check-links?includeNameMatches=true', {
      method: 'POST',
    });
    const res = await POST(req);
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.linkedByName).toBe(1);
    expect(data.totalLinked).toBe(1);
  });

  it('handles case-insensitive email matching', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockSuperAdmin as any);

    const unlinkedUsers = [
      { id: 'u1', name: 'Alice', email: 'ALICE@TEST.COM' },
    ];
    const unlinkedProfiles = [
      { id: 'p1', name: 'Alice Profile', email: 'alice@test.com' },
    ];

    vi.mocked(prisma.user.findMany).mockResolvedValue(unlinkedUsers as any);
    vi.mocked(prisma.riderProfile.findMany).mockResolvedValue(unlinkedProfiles as any);
    vi.mocked(prisma.user.update).mockResolvedValue({} as any);
    vi.mocked(prisma.rideParticipation.findMany).mockResolvedValue([]);

    const req = createNextRequest('http://localhost:3000/api/riders/check-links', {
      method: 'POST',
    });
    const res = await POST(req);
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.linkedByEmail).toBe(1);
  });

  it('handles no unlinked users gracefully', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockSuperAdmin as any);
    vi.mocked(prisma.user.findMany).mockResolvedValue([]);
    vi.mocked(prisma.riderProfile.findMany).mockResolvedValue([]);

    const req = createNextRequest('http://localhost:3000/api/riders/check-links', {
      method: 'POST',
    });
    const res = await POST(req);
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.totalLinked).toBe(0);
    expect(data.linked).toEqual([]);
  });
});
