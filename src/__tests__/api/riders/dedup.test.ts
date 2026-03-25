import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseResponse, mockSuperAdmin, mockCoreMember } from '@/__tests__/helpers';

vi.mock('@/lib/db', () => ({
  prisma: {
    riderProfile: { findMany: vi.fn(), update: vi.fn() },
    rideParticipation: { findMany: vi.fn(), delete: vi.fn(), update: vi.fn() },
    user: { updateMany: vi.fn() },
  },
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}));

import { POST } from '@/app/api/riders/dedup/route';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

describe('POST /api/riders/dedup', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 403 for non-superadmin', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockCoreMember as any);

    const res = await POST();
    const { status, data } = await parseResponse(res);
    expect(status).toBe(403);
    expect(data.error).toContain('super admin');
  });

  it('returns 403 for unauthenticated', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const res = await POST();
    const { status } = await parseResponse(res);
    expect(status).toBe(403);
  });

  it('handles no duplicates gracefully', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockSuperAdmin as any);
    vi.mocked(prisma.riderProfile.findMany).mockResolvedValue([
      {
        id: 'p1',
        name: 'Alice',
        email: 'alice@test.com',
        createdAt: new Date('2024-01-01'),
        participations: [{ id: 'part-1', rideId: 'r1', points: 5 }],
        ridesOrganized: 0,
        sweepsDone: 0,
        pilotsDone: 0,
        joinDate: new Date('2024-01-01'),
        phone: '',
        address: '',
        emergencyContact: '',
        emergencyPhone: '',
        bloodGroup: '',
        avatarUrl: '',
      },
    ] as any);

    const res = await POST();
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.mergedCount).toBe(0);
    expect(data.details).toEqual([]);
  });

  it('merges duplicate profiles keeping the one with more participations', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockSuperAdmin as any);

    const profiles = [
      {
        id: 'p1',
        name: 'Alice A',
        email: 'alice@test.com',
        createdAt: new Date('2024-01-01'),
        participations: [
          { id: 'part-1', rideId: 'r1', points: 5 },
          { id: 'part-2', rideId: 'r2', points: 5 },
        ],
        ridesOrganized: 1,
        sweepsDone: 0,
        pilotsDone: 0,
        joinDate: new Date('2024-02-01'),
        phone: '111',
        address: '',
        emergencyContact: '',
        emergencyPhone: '',
        bloodGroup: '',
        avatarUrl: '',
      },
      {
        id: 'p2',
        name: 'Alice B',
        email: 'alice@test.com',
        createdAt: new Date('2024-03-01'),
        participations: [{ id: 'part-3', rideId: 'r3', points: 5 }],
        ridesOrganized: 0,
        sweepsDone: 1,
        pilotsDone: 0,
        joinDate: new Date('2024-01-15'),
        phone: '',
        address: '123 St',
        emergencyContact: '',
        emergencyPhone: '',
        bloodGroup: '',
        avatarUrl: '',
      },
    ];

    vi.mocked(prisma.riderProfile.findMany).mockResolvedValue(profiles as any);
    // Target already has ride r1 and r2; source has r3 (no overlap)
    vi.mocked(prisma.rideParticipation.findMany)
      .mockResolvedValueOnce([{ rideId: 'r1' }, { rideId: 'r2' }] as any) // target ride IDs
      .mockResolvedValueOnce([{ ride: { distanceKm: 50 } }, { ride: { distanceKm: 75 } }, { ride: { distanceKm: 100 } }] as any); // final participations
    vi.mocked(prisma.rideParticipation.update).mockResolvedValue({} as any);
    vi.mocked(prisma.riderProfile.update).mockResolvedValue({} as any);
    vi.mocked(prisma.user.updateMany).mockResolvedValue({ count: 1 } as any);

    const res = await POST();
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.mergedCount).toBe(1);
    // p1 kept (more participations), p2 merged into p1
    expect(data.details).toHaveLength(1);
    expect(data.details[0].email).toBe('alice@test.com');
    // Source participation (r3) moved to target
    expect(prisma.rideParticipation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'part-3' },
        data: { riderProfileId: 'p1' },
      })
    );
  });

  it('returns merge results', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockSuperAdmin as any);

    const profiles = [
      {
        id: 'p1',
        name: 'Bob X',
        email: 'bob@test.com',
        createdAt: new Date('2024-01-01'),
        participations: [{ id: 'part-1', rideId: 'r1', points: 5 }],
        ridesOrganized: 0,
        sweepsDone: 0,
        pilotsDone: 0,
        joinDate: new Date('2024-01-01'),
        phone: '',
        address: '',
        emergencyContact: '',
        emergencyPhone: '',
        bloodGroup: '',
        avatarUrl: '',
      },
      {
        id: 'p2',
        name: 'Bob Y',
        email: 'bob@test.com',
        createdAt: new Date('2024-02-01'),
        participations: [],
        ridesOrganized: 0,
        sweepsDone: 0,
        pilotsDone: 0,
        joinDate: new Date('2024-02-01'),
        phone: '',
        address: '',
        emergencyContact: '',
        emergencyPhone: '',
        bloodGroup: '',
        avatarUrl: '',
      },
    ];

    vi.mocked(prisma.riderProfile.findMany).mockResolvedValue(profiles as any);
    vi.mocked(prisma.rideParticipation.findMany)
      .mockResolvedValueOnce([{ rideId: 'r1' }] as any) // target ride IDs
      .mockResolvedValueOnce([{ ride: { distanceKm: 100 } }] as any); // final
    vi.mocked(prisma.riderProfile.update).mockResolvedValue({} as any);
    vi.mocked(prisma.user.updateMany).mockResolvedValue({ count: 0 } as any);

    const res = await POST();
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.details[0].kept).toContain('Bob X');
    expect(data.details[0].merged[0]).toContain('Bob Y');
  });
});
