import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNextRequest, parseResponse, mockSuperAdmin, mockCoreMember } from '@/__tests__/helpers';

vi.mock('@/lib/db', () => ({
  prisma: {
    riderProfile: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    rideParticipation: { delete: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    user: { updateMany: vi.fn() },
  },
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}));

import { GET, POST } from '@/app/api/riders/merge/route';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

describe('POST /api/riders/merge', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 403 for non-superadmin', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockCoreMember as any);

    const req = createNextRequest('http://localhost:3000/api/riders/merge', {
      method: 'POST',
      body: { sourceId: 'p1', targetId: 'p2' },
    });
    const res = await POST(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(403);
  });

  it('returns 403 for unauthenticated users', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const req = createNextRequest('http://localhost:3000/api/riders/merge', {
      method: 'POST',
      body: { sourceId: 'p1', targetId: 'p2' },
    });
    const res = await POST(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(403);
  });

  it('returns 400 when sourceId or targetId missing', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockSuperAdmin as any);

    const req = createNextRequest('http://localhost:3000/api/riders/merge', {
      method: 'POST',
      body: { sourceId: 'p1' },
    });
    const res = await POST(req);
    const { status, data } = await parseResponse(res);
    expect(status).toBe(400);
    expect(data.error).toContain('required');
  });

  it('returns 400 when merging profile into itself', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockSuperAdmin as any);

    const req = createNextRequest('http://localhost:3000/api/riders/merge', {
      method: 'POST',
      body: { sourceId: 'p1', targetId: 'p1' },
    });
    const res = await POST(req);
    const { status, data } = await parseResponse(res);
    expect(status).toBe(400);
    expect(data.error).toContain('itself');
  });

  it('returns 404 when source profile not found', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockSuperAdmin as any);
    vi.mocked(prisma.riderProfile.findUnique)
      .mockResolvedValueOnce(null) // source
      .mockResolvedValueOnce({ id: 'p2', participations: [] } as any); // target

    const req = createNextRequest('http://localhost:3000/api/riders/merge', {
      method: 'POST',
      body: { sourceId: 'p1', targetId: 'p2' },
    });
    const res = await POST(req);
    const { status, data } = await parseResponse(res);
    expect(status).toBe(404);
    expect(data.error).toContain('Source');
  });

  it('returns 404 when target profile not found', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockSuperAdmin as any);
    vi.mocked(prisma.riderProfile.findUnique)
      .mockResolvedValueOnce({
        id: 'p1',
        name: 'Source',
        participations: [],
        ridesOrganized: 0,
        sweepsDone: 0,
        pilotsDone: 0,
        joinDate: new Date('2024-01-01'),
        phone: '',
        address: '',
        emergencyContact: '',
        emergencyPhone: '',
        bloodGroup: '',
      } as any) // source
      .mockResolvedValueOnce(null); // target

    const req = createNextRequest('http://localhost:3000/api/riders/merge', {
      method: 'POST',
      body: { sourceId: 'p1', targetId: 'p2' },
    });
    const res = await POST(req);
    const { status, data } = await parseResponse(res);
    expect(status).toBe(404);
    expect(data.error).toContain('Target');
  });

  it('successfully merges profiles and moves participations', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockSuperAdmin as any);

    const source = {
      id: 'p1',
      name: 'Alice Source',
      participations: [
        { id: 'part-1', rideId: 'r1', points: 5 },
        { id: 'part-2', rideId: 'r3', points: 5 },
      ],
      ridesOrganized: 1,
      sweepsDone: 1,
      pilotsDone: 0,
      joinDate: new Date('2024-01-01'),
      phone: '111',
      address: '',
      emergencyContact: '',
      emergencyPhone: '',
      bloodGroup: 'A+',
    };

    const target = {
      id: 'p2',
      name: 'Alice Target',
      participations: [
        { id: 'part-3', rideId: 'r1', points: 5 },
        { id: 'part-4', rideId: 'r2', points: 5 },
      ],
      ridesOrganized: 0,
      sweepsDone: 0,
      pilotsDone: 1,
      joinDate: new Date('2024-06-01'),
      phone: '',
      address: '123 St',
      emergencyContact: '',
      emergencyPhone: '',
      bloodGroup: '',
    };

    vi.mocked(prisma.riderProfile.findUnique)
      .mockResolvedValueOnce(source as any)
      .mockResolvedValueOnce(target as any);
    vi.mocked(prisma.rideParticipation.delete).mockResolvedValue({} as any);
    vi.mocked(prisma.rideParticipation.update).mockResolvedValue({} as any);
    vi.mocked(prisma.riderProfile.update).mockResolvedValue({} as any);
    vi.mocked(prisma.user.updateMany).mockResolvedValue({ count: 1 } as any);
    vi.mocked(prisma.rideParticipation.findMany).mockResolvedValue([
      { ride: { distanceKm: 50 } },
      { ride: { distanceKm: 75 } },
      { ride: { distanceKm: 100 } },
    ] as any);

    const req = createNextRequest('http://localhost:3000/api/riders/merge', {
      method: 'POST',
      body: { sourceId: 'p1', targetId: 'p2' },
    });
    const res = await POST(req);
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.mergedFrom).toBe('Alice Source');
    expect(data.mergedInto).toBe('Alice Target');
    expect(data.participationsMoved).toBe(1); // r3 moved, r1 deleted (overlap)

    // r1 is a duplicate - should be deleted
    expect(prisma.rideParticipation.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'part-1' } })
    );
    // r3 is unique - should be moved to target
    expect(prisma.rideParticipation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'part-2' },
        data: { riderProfileId: 'p2' },
      })
    );
    // Source should be marked as merged
    expect(prisma.riderProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'p1' },
        data: { mergedIntoId: 'p2' },
      })
    );
    // Stats should be accumulated on target
    expect(prisma.riderProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'p2' },
        data: expect.objectContaining({
          ridesOrganized: 1,
          sweepsDone: 1,
          pilotsDone: 1,
          phone: '111',
          bloodGroup: 'A+',
        }),
      })
    );
    // Users linked to source should be re-linked to target
    expect(prisma.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { linkedRiderId: 'p1' },
        data: { linkedRiderId: 'p2' },
      })
    );
  });
});

describe('GET /api/riders/merge', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 403 for non-superadmin', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockCoreMember as any);

    const res = await GET();
    const { status } = await parseResponse(res);
    expect(status).toBe(403);
  });

  it('returns 403 for unauthenticated users', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const res = await GET();
    const { status } = await parseResponse(res);
    expect(status).toBe(403);
  });

  it('returns duplicate profiles grouped by email', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockSuperAdmin as any);
    vi.mocked(prisma.riderProfile.findMany).mockResolvedValue([
      { id: 'p1', name: 'Alice A', email: 'alice@test.com', phone: '111' },
      { id: 'p2', name: 'Alice B', email: 'alice@test.com', phone: '222' },
      { id: 'p3', name: 'Bob', email: 'bob@test.com', phone: '333' },
    ] as any);

    const res = await GET();
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.duplicates).toBeDefined();
    expect(data.duplicates.length).toBeGreaterThanOrEqual(1);
    const emailDup = data.duplicates.find((d: any) => d.type === 'email' && d.key === 'alice@test.com');
    expect(emailDup).toBeDefined();
    expect(emailDup.profiles).toHaveLength(2);
  });

  it('returns empty duplicates when no duplicates exist', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockSuperAdmin as any);
    vi.mocked(prisma.riderProfile.findMany).mockResolvedValue([
      { id: 'p1', name: 'Alice', email: 'alice@test.com', phone: '111' },
      { id: 'p2', name: 'Bob', email: 'bob@test.com', phone: '222' },
    ] as any);

    const res = await GET();
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.duplicates).toEqual([]);
  });
});
