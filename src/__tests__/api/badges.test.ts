import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseResponse, mockRider } from '@/__tests__/helpers';

vi.mock('@/lib/db', () => ({
  prisma: {
    badge: {
      findMany: vi.fn(),
    },
    userBadge: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}));

import { GET, POST, awardBadgesForUser } from '@/app/api/badges/route';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

const mockGetCurrentUser = getCurrentUser as ReturnType<typeof vi.fn>;
const mockBadgeFindMany = prisma.badge.findMany as ReturnType<typeof vi.fn>;
const mockUserBadgeFindMany = prisma.userBadge.findMany as ReturnType<typeof vi.fn>;
const mockUserBadgeCreate = prisma.userBadge.create as ReturnType<typeof vi.fn>;

describe('GET /api/badges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns badges ordered by minKm', async () => {
    const badges = [
      { id: 'b-1', name: 'Beginner', minKm: 100 },
      { id: 'b-2', name: 'Explorer', minKm: 500 },
      { id: 'b-3', name: 'Veteran', minKm: 5000 },
    ];
    mockBadgeFindMany.mockResolvedValue(badges);

    const { status, data } = await parseResponse(await GET());

    expect(status).toBe(200);
    expect(data.badges).toHaveLength(3);
    expect(mockBadgeFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { minKm: 'asc' },
      })
    );
  });
});

describe('POST /api/badges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 for unauthenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const { status, data } = await parseResponse(await POST());

    expect(status).toBe(401);
    expect(data.error).toBe('Not authenticated');
  });

  it('awards badges based on user totalKm', async () => {
    mockGetCurrentUser.mockResolvedValue(mockRider); // totalKm = 100
    const badges = [
      { id: 'b-1', name: 'Beginner', minKm: 50 },
      { id: 'b-2', name: 'Explorer', minKm: 100 },
      { id: 'b-3', name: 'Veteran', minKm: 5000 },
    ];
    mockBadgeFindMany.mockResolvedValue(badges);
    mockUserBadgeFindMany.mockResolvedValue([]); // no existing badges
    mockUserBadgeCreate.mockResolvedValue({});

    const { status, data } = await parseResponse(await POST());

    expect(status).toBe(200);
    // Rider has 100km, should earn Beginner (50km) and Explorer (100km) but not Veteran (5000km)
    expect(data.awarded).toEqual(['Beginner', 'Explorer']);
    expect(mockUserBadgeCreate).toHaveBeenCalledTimes(2);
  });
});

describe('awardBadgesForUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips already-earned badges', async () => {
    const badges = [
      { id: 'b-1', name: 'Beginner', minKm: 50 },
      { id: 'b-2', name: 'Explorer', minKm: 100 },
    ];
    mockBadgeFindMany.mockResolvedValue(badges);
    mockUserBadgeFindMany.mockResolvedValue([{ badgeId: 'b-1' }]); // already has Beginner
    mockUserBadgeCreate.mockResolvedValue({});

    const awarded = await awardBadgesForUser('user-3', 200);

    expect(awarded).toEqual(['Explorer']);
    expect(mockUserBadgeCreate).toHaveBeenCalledTimes(1);
  });
});
