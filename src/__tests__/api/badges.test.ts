import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNextRequest, parseResponse, mockRider, mockSuperAdmin, mockCoreMember } from '@/__tests__/helpers';

vi.mock('@/lib/db', () => ({
  prisma: {
    badge: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    userBadge: {
      findMany: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}));

import { GET, POST, PUT, awardBadgesForUser } from '@/app/api/badges/route';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

const mockGetCurrentUser = getCurrentUser as ReturnType<typeof vi.fn>;
const mockBadgeFindMany = prisma.badge.findMany as ReturnType<typeof vi.fn>;
const mockBadgeUpdate = prisma.badge.update as ReturnType<typeof vi.fn>;
const mockUserBadgeFindMany = prisma.userBadge.findMany as ReturnType<typeof vi.fn>;
const mockUserBadgeCreate = prisma.userBadge.create as ReturnType<typeof vi.fn>;
const mockUserBadgeUpsert = prisma.userBadge.upsert as ReturnType<typeof vi.fn>;

const sampleBadges = [
  { id: 'b-1', tier: 'SILVER', name: 'Silver Rider', description: 'Completed 1,000 km', minKm: 1000, icon: 'shield', color: '#C0C0C0' },
  { id: 'b-2', tier: 'GOLD', name: 'Gold Rider', description: 'Completed 5,000 km', minKm: 5000, icon: 'award', color: '#FFD700' },
  { id: 'b-3', tier: 'PLATINUM', name: 'Platinum Rider', description: 'Completed 15,000 km', minKm: 15000, icon: 'star', color: '#E5E4E2' },
];

describe('GET /api/badges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns badges ordered by minKm', async () => {
    mockBadgeFindMany.mockResolvedValue(sampleBadges);

    const { status, data } = await parseResponse(await GET());

    expect(status).toBe(200);
    expect(data.badges).toHaveLength(3);
    expect(data.badges[0].tier).toBe('SILVER');
    expect(data.badges[1].tier).toBe('GOLD');
    expect(data.badges[2].tier).toBe('PLATINUM');
    expect(mockBadgeFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { minKm: 'asc' },
      })
    );
  });

  it('returns empty array when no badges exist', async () => {
    mockBadgeFindMany.mockResolvedValue([]);

    const { status, data } = await parseResponse(await GET());

    expect(status).toBe(200);
    expect(data.badges).toHaveLength(0);
  });

  it('returns 500 on database error', async () => {
    mockBadgeFindMany.mockRejectedValue(new Error('DB connection failed'));

    const { status, data } = await parseResponse(await GET());

    expect(status).toBe(500);
    expect(data.error).toBe('Failed to load badges');
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
    mockUserBadgeUpsert.mockResolvedValue({});

    const { status, data } = await parseResponse(await POST());

    expect(status).toBe(200);
    // Rider has 100km, should earn Beginner (50km) and Explorer (100km) but not Veteran (5000km)
    expect(data.awarded).toEqual(['Beginner', 'Explorer']);
    expect(mockUserBadgeUpsert).toHaveBeenCalledTimes(2);
  });

  it('awards no badges if user totalKm is below all thresholds', async () => {
    mockGetCurrentUser.mockResolvedValue({ ...mockRider, totalKm: 10 });
    const badges = [
      { id: 'b-1', name: 'Beginner', minKm: 50 },
      { id: 'b-2', name: 'Explorer', minKm: 100 },
    ];
    mockBadgeFindMany.mockResolvedValue(badges);
    mockUserBadgeFindMany.mockResolvedValue([]);

    const { status, data } = await parseResponse(await POST());

    expect(status).toBe(200);
    expect(data.awarded).toEqual([]);
    expect(mockUserBadgeCreate).not.toHaveBeenCalled();
  });
});

describe('PUT /api/badges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 403 for unauthenticated users', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const req = createNextRequest('http://localhost:3000/api/badges', {
      method: 'PUT',
      body: { id: 'b-1', name: 'Updated Badge' },
    });
    const { status, data } = await parseResponse(await PUT(req));

    expect(status).toBe(403);
    expect(data.error).toBe('Forbidden');
  });

  it('returns 403 for regular riders', async () => {
    mockGetCurrentUser.mockResolvedValue(mockRider);

    const req = createNextRequest('http://localhost:3000/api/badges', {
      method: 'PUT',
      body: { id: 'b-1', name: 'Updated Badge' },
    });
    const { status, data } = await parseResponse(await PUT(req));

    expect(status).toBe(403);
    expect(data.error).toBe('Forbidden');
  });

  it('returns 403 for core members', async () => {
    mockGetCurrentUser.mockResolvedValue(mockCoreMember);

    const req = createNextRequest('http://localhost:3000/api/badges', {
      method: 'PUT',
      body: { id: 'b-1', name: 'Updated Badge' },
    });
    const { status, data } = await parseResponse(await PUT(req));

    expect(status).toBe(403);
    expect(data.error).toBe('Forbidden');
  });

  it('returns 400 when badge id is missing', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);

    const req = createNextRequest('http://localhost:3000/api/badges', {
      method: 'PUT',
      body: { name: 'Updated Badge' },
    });
    const { status, data } = await parseResponse(await PUT(req));

    expect(status).toBe(400);
    expect(data.error).toBe('Badge id is required');
  });

  it('updates badge name for superadmin', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);
    const updatedBadge = { ...sampleBadges[0], name: 'Silver Champion' };
    mockBadgeUpdate.mockResolvedValue(updatedBadge);

    const req = createNextRequest('http://localhost:3000/api/badges', {
      method: 'PUT',
      body: { id: 'b-1', name: 'Silver Champion' },
    });
    const { status, data } = await parseResponse(await PUT(req));

    expect(status).toBe(200);
    expect(data.badge.name).toBe('Silver Champion');
    expect(mockBadgeUpdate).toHaveBeenCalledWith({
      where: { id: 'b-1' },
      data: { name: 'Silver Champion' },
    });
  });

  it('updates badge minKm and converts to number', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);
    const updatedBadge = { ...sampleBadges[0], minKm: 2000 };
    mockBadgeUpdate.mockResolvedValue(updatedBadge);

    const req = createNextRequest('http://localhost:3000/api/badges', {
      method: 'PUT',
      body: { id: 'b-1', minKm: '2000' },
    });
    const { status, data } = await parseResponse(await PUT(req));

    expect(status).toBe(200);
    expect(data.badge.minKm).toBe(2000);
    expect(mockBadgeUpdate).toHaveBeenCalledWith({
      where: { id: 'b-1' },
      data: { minKm: 2000 },
    });
  });

  it('updates multiple fields at once', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);
    const updatedBadge = {
      ...sampleBadges[0],
      name: 'New Silver',
      description: 'New description',
      minKm: 1500,
      icon: 'star',
      color: '#AAAAAA',
    };
    mockBadgeUpdate.mockResolvedValue(updatedBadge);

    const req = createNextRequest('http://localhost:3000/api/badges', {
      method: 'PUT',
      body: {
        id: 'b-1',
        name: 'New Silver',
        description: 'New description',
        minKm: 1500,
        icon: 'star',
        color: '#AAAAAA',
      },
    });
    const { status, data } = await parseResponse(await PUT(req));

    expect(status).toBe(200);
    expect(data.badge.name).toBe('New Silver');
    expect(mockBadgeUpdate).toHaveBeenCalledWith({
      where: { id: 'b-1' },
      data: {
        name: 'New Silver',
        description: 'New description',
        minKm: 1500,
        icon: 'star',
        color: '#AAAAAA',
      },
    });
  });

  it('only includes provided fields in update (partial update)', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);
    mockBadgeUpdate.mockResolvedValue({ ...sampleBadges[0], color: '#FF0000' });

    const req = createNextRequest('http://localhost:3000/api/badges', {
      method: 'PUT',
      body: { id: 'b-1', color: '#FF0000' },
    });
    const { status } = await parseResponse(await PUT(req));

    expect(status).toBe(200);
    // Should only update color, not include undefined fields
    expect(mockBadgeUpdate).toHaveBeenCalledWith({
      where: { id: 'b-1' },
      data: { color: '#FF0000' },
    });
  });

  it('returns 500 on database error', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);
    mockBadgeUpdate.mockRejectedValue(new Error('Record not found'));

    const req = createNextRequest('http://localhost:3000/api/badges', {
      method: 'PUT',
      body: { id: 'nonexistent', name: 'Test' },
    });
    const { status, data } = await parseResponse(await PUT(req));

    expect(status).toBe(500);
    expect(data.error).toBe('Failed to update badge');
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
    mockUserBadgeUpsert.mockResolvedValue({});

    const awarded = await awardBadgesForUser('user-3', 200);

    expect(awarded).toEqual(['Explorer']);
    expect(mockUserBadgeUpsert).toHaveBeenCalledTimes(1);
    expect(mockUserBadgeUpsert).toHaveBeenCalledWith({
      where: { userId_badgeId: { userId: 'user-3', badgeId: 'b-2' } },
      update: {},
      create: { userId: 'user-3', badgeId: 'b-2' },
    });
  });

  it('returns empty array when all badges already earned', async () => {
    const badges = [
      { id: 'b-1', name: 'Beginner', minKm: 50 },
      { id: 'b-2', name: 'Explorer', minKm: 100 },
    ];
    mockBadgeFindMany.mockResolvedValue(badges);
    mockUserBadgeFindMany.mockResolvedValue([
      { badgeId: 'b-1' },
      { badgeId: 'b-2' },
    ]);

    const awarded = await awardBadgesForUser('user-3', 200);

    expect(awarded).toEqual([]);
    expect(mockUserBadgeCreate).not.toHaveBeenCalled();
  });

  it('awards all eligible badges for high-km user', async () => {
    const badges = [
      { id: 'b-1', name: 'Silver', minKm: 1000 },
      { id: 'b-2', name: 'Gold', minKm: 5000 },
      { id: 'b-3', name: 'Platinum', minKm: 15000 },
    ];
    mockBadgeFindMany.mockResolvedValue(badges);
    mockUserBadgeFindMany.mockResolvedValue([]);
    mockUserBadgeUpsert.mockResolvedValue({});

    const awarded = await awardBadgesForUser('user-1', 20000);

    expect(awarded).toEqual(['Silver', 'Gold', 'Platinum']);
    expect(mockUserBadgeUpsert).toHaveBeenCalledTimes(3);
  });

  it('does not award badges when totalKm is exactly below threshold', async () => {
    const badges = [
      { id: 'b-1', name: 'Silver', minKm: 1000 },
    ];
    mockBadgeFindMany.mockResolvedValue(badges);
    mockUserBadgeFindMany.mockResolvedValue([]);

    const awarded = await awardBadgesForUser('user-3', 999);

    expect(awarded).toEqual([]);
    expect(mockUserBadgeCreate).not.toHaveBeenCalled();
  });

  it('awards badge when totalKm exactly equals threshold', async () => {
    const badges = [
      { id: 'b-1', name: 'Silver', minKm: 1000 },
    ];
    mockBadgeFindMany.mockResolvedValue(badges);
    mockUserBadgeFindMany.mockResolvedValue([]);
    mockUserBadgeUpsert.mockResolvedValue({});

    const awarded = await awardBadgesForUser('user-3', 1000);

    expect(awarded).toEqual(['Silver']);
    expect(mockUserBadgeUpsert).toHaveBeenCalledTimes(1);
  });
});
