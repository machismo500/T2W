import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseResponse, mockSuperAdmin, mockCoreMember, mockRider } from '@/__tests__/helpers';

vi.mock('@/lib/db', () => ({
  prisma: {
    rideParticipation: {
      updateMany: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    ride: { findMany: vi.fn() },
    riderProfile: { findMany: vi.fn(), updateMany: vi.fn() },
    user: { findMany: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
  },
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}));

import { POST } from '@/app/api/riders/sync-roles/route';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

describe('POST /api/riders/sync-roles', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 403 for non-superadmin', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockCoreMember as any);

    const res = await POST();
    const { status } = await parseResponse(res);
    expect(status).toBe(403);
  });

  it('returns 403 for unauthenticated users', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const res = await POST();
    const { status } = await parseResponse(res);
    expect(status).toBe(403);
  });

  it('returns 403 for regular riders', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockRider as any);

    const res = await POST();
    const { status } = await parseResponse(res);
    expect(status).toBe(403);
  });

  it('returns success with sync statistics', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockSuperAdmin as any);

    // Step 1: clear dropouts
    vi.mocked(prisma.rideParticipation.updateMany).mockResolvedValue({ count: 2 } as any);

    // Step 2: cross-reference rides
    vi.mocked(prisma.ride.findMany).mockResolvedValue([
      { id: 'r1', riders: JSON.stringify(['Alice', 'Bob']), distanceKm: 100 },
    ] as any);

    vi.mocked(prisma.riderProfile.findMany)
      .mockResolvedValueOnce([
        { id: 'p1', name: 'Alice' },
        { id: 'p2', name: 'Bob' },
      ] as any) // allProfiles for name matching
      .mockResolvedValueOnce([
        { id: 'p3' },
      ] as any) // profilesWithParticipation (role=rider with participations)
      .mockResolvedValueOnce([] as any); // profilesWithoutParticipation (role=t2w_rider without participations)

    // Existing participations
    vi.mocked(prisma.rideParticipation.findMany)
      .mockResolvedValueOnce([
        { riderProfileId: 'p1', rideId: 'r1' },
      ] as any) // existing participations
      .mockResolvedValueOnce([
        { ride: { distanceKm: 100 } },
      ] as any); // participations for user u1 stats recalc

    // Create missing participation for Bob
    vi.mocked(prisma.rideParticipation.create).mockResolvedValue({} as any);

    // Privileged users sync
    vi.mocked(prisma.user.findMany)
      .mockResolvedValueOnce([] as any) // privilegedUsers (superadmin/core_member with linked profiles)
      .mockResolvedValueOnce([] as any) // ridersToUpgrade (role=rider with linked profiles)
      .mockResolvedValueOnce([] as any) // t2wRiders (role=t2w_rider)
      .mockResolvedValueOnce([
        { id: 'u1', linkedRiderId: 'p1' },
      ] as any); // allLinkedUsers for stats recalc

    vi.mocked(prisma.rideParticipation.count).mockResolvedValue(0);
    vi.mocked(prisma.user.updateMany).mockResolvedValue({ count: 0 } as any);
    vi.mocked(prisma.user.update).mockResolvedValue({} as any);

    const res = await POST();
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.clearedDropouts).toBe(2);
    expect(data.createdMissingParticipations).toBe(1); // Bob's missing participation
    expect(typeof data.upgradedToT2WRider).toBe('number');
    expect(typeof data.downgradedToRider).toBe('number');
    expect(typeof data.privilegedRolesSynced).toBe('number');
  });

  it('handles empty data gracefully', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockSuperAdmin as any);

    // No dropouts to clear
    vi.mocked(prisma.rideParticipation.updateMany).mockResolvedValue({ count: 0 } as any);

    // No completed rides
    vi.mocked(prisma.ride.findMany).mockResolvedValue([]);

    // No profiles
    vi.mocked(prisma.riderProfile.findMany)
      .mockResolvedValueOnce([] as any) // allProfiles
      .mockResolvedValueOnce([] as any) // profilesWithParticipation
      .mockResolvedValueOnce([] as any); // profilesWithoutParticipation

    // No existing participations
    vi.mocked(prisma.rideParticipation.findMany).mockResolvedValue([]);

    // No users
    vi.mocked(prisma.user.findMany)
      .mockResolvedValueOnce([] as any) // privilegedUsers
      .mockResolvedValueOnce([] as any) // ridersToUpgrade
      .mockResolvedValueOnce([] as any) // t2wRiders
      .mockResolvedValueOnce([] as any); // allLinkedUsers

    vi.mocked(prisma.user.updateMany).mockResolvedValue({ count: 0 } as any);

    const res = await POST();
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.clearedDropouts).toBe(0);
    expect(data.createdMissingParticipations).toBe(0);
    expect(data.upgradedToT2WRider).toBe(0);
    expect(data.downgradedToRider).toBe(0);
    expect(data.privilegedRolesSynced).toBe(0);
    expect(data.profilesUpgraded).toBe(0);
    expect(data.profilesDowngraded).toBe(0);
  });

  it('upgrades riders with participations to t2w_rider', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockSuperAdmin as any);

    vi.mocked(prisma.rideParticipation.updateMany).mockResolvedValue({ count: 0 } as any);
    vi.mocked(prisma.ride.findMany).mockResolvedValue([]);

    vi.mocked(prisma.riderProfile.findMany)
      .mockResolvedValueOnce([] as any) // allProfiles
      .mockResolvedValueOnce([] as any) // profilesWithParticipation
      .mockResolvedValueOnce([] as any); // profilesWithoutParticipation

    vi.mocked(prisma.rideParticipation.findMany)
      .mockResolvedValueOnce([] as any) // existing participations
      .mockResolvedValueOnce([
        { ride: { distanceKm: 200 } },
      ] as any); // participations for user u1 stats

    vi.mocked(prisma.user.findMany)
      .mockResolvedValueOnce([] as any) // privilegedUsers
      .mockResolvedValueOnce([
        { id: 'u1', linkedRiderId: 'p1' },
      ] as any) // ridersToUpgrade
      .mockResolvedValueOnce([] as any) // upgradedUsers (for RiderProfile sync)
      .mockResolvedValueOnce([] as any) // t2wRiders
      .mockResolvedValueOnce([
        { id: 'u1', linkedRiderId: 'p1' },
      ] as any); // allLinkedUsers

    // u1 has participations -> should be upgraded
    vi.mocked(prisma.rideParticipation.count).mockResolvedValue(3);
    vi.mocked(prisma.user.updateMany).mockResolvedValue({ count: 1 } as any);
    vi.mocked(prisma.riderProfile.updateMany).mockResolvedValue({ count: 1 } as any);
    vi.mocked(prisma.user.update).mockResolvedValue({} as any);

    const res = await POST();
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.upgradedToT2WRider).toBe(1);
  });
});
