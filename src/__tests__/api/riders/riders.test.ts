import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNextRequest, parseResponse, mockSuperAdmin, mockCoreMember, mockRider, mockT2WRider } from '@/__tests__/helpers';

vi.mock('@/lib/db', () => ({
  prisma: {
    riderProfile: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    siteSettings: { findUnique: vi.fn() },
  },
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}));

const { mockGetRolePermissions } = vi.hoisted(() => ({
  mockGetRolePermissions: vi.fn(),
}));

vi.mock('@/lib/role-permissions', () => ({
  getRolePermissions: mockGetRolePermissions,
}));

const defaultRolePerms = {
  rider: { canRegisterForRides: true, canEditOwnProfile: true, canViewLiveTracking: true, canDownloadRideDocuments: false },
  t2w_rider: { canPostBlog: true, canPostRideTales: true, earlyRegistrationAccess: true, canViewMemberDirectory: false },
  core_member: { canCreateRide: true, canEditRide: true, canManageRegistrations: true, canExportRegistrations: true, canControlLiveTracking: true, canApproveContent: true, canApproveUsers: true, canViewActivityLog: true, canManageRoles: false, canManageBadges: false },
};

import { GET, POST } from '@/app/api/riders/route';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

const mockGetCurrentUser = getCurrentUser as ReturnType<typeof vi.fn>;
const mockProfileFindMany = prisma.riderProfile.findMany as ReturnType<typeof vi.fn>;
const mockProfileCreate = prisma.riderProfile.create as ReturnType<typeof vi.fn>;
const mockUserFindUnique = prisma.user.findUnique as ReturnType<typeof vi.fn>;

const mockProfile = {
  id: 'rider-1',
  name: 'Test Rider',
  email: 'rider@t2w.com',
  phone: '9876543210',
  address: 'Bangalore',
  emergencyContact: 'Emergency Person',
  emergencyPhone: '1234567890',
  bloodGroup: 'O+',
  joinDate: new Date('2024-06-01'),
  avatarUrl: null,
  role: 'rider',
  mergedIntoId: null,
  ridesOrganized: 0,
  sweepsDone: 0,
  pilotsDone: 0,
  linkedUsers: [{ role: 'rider' }],
  participations: [
    {
      droppedOut: false,
      points: 5,
      ride: {
        id: 'ride-1',
        rideNumber: '#001',
        title: 'Weekend Ride',
        startDate: new Date('2024-07-01'),
        distanceKm: 150,
      },
    },
  ],
};

describe('GET /api/riders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRolePermissions.mockResolvedValue(defaultRolePerms);
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);
  });

  it('returns rider profiles with stats', async () => {
    mockProfileFindMany.mockResolvedValue([mockProfile]);

    const req = createNextRequest('http://localhost:3000/api/riders');
    const { status, data } = await parseResponse(await GET(req));

    expect(status).toBe(200);
    expect(data.riders).toHaveLength(1);
    expect(data.riders[0].name).toBe('Test Rider');
    expect(data.riders[0].ridesCompleted).toBe(1);
    expect(data.riders[0].totalKm).toBe(150);
    expect(data.riders[0].totalPoints).toBe(5);
  });

  it('excludes merged profiles by default', async () => {
    mockProfileFindMany.mockResolvedValue([]);

    const req = createNextRequest('http://localhost:3000/api/riders');
    await GET(req);

    expect(mockProfileFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ mergedIntoId: null }),
      })
    );
  });

  it('includes merged profiles when ?includemerged=true', async () => {
    mockProfileFindMany.mockResolvedValue([]);

    const req = createNextRequest('http://localhost:3000/api/riders?includemerged=true');
    await GET(req);

    expect(mockProfileFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({ mergedIntoId: null }),
      })
    );
  });

  it('filters by search query', async () => {
    mockProfileFindMany.mockResolvedValue([]);

    const req = createNextRequest('http://localhost:3000/api/riders?search=john');
    await GET(req);

    expect(mockProfileFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { name: { contains: 'john', mode: 'insensitive' } },
            { email: { contains: 'john', mode: 'insensitive' } },
          ],
        }),
      })
    );
  });

  it('excludes dropped-out participations from stats', async () => {
    const profileWithDropout = {
      ...mockProfile,
      participations: [
        ...mockProfile.participations,
        {
          droppedOut: true,
          points: 5,
          ride: {
            id: 'ride-2',
            rideNumber: '#002',
            title: 'Dropped Ride',
            startDate: new Date('2024-08-01'),
            distanceKm: 200,
          },
        },
      ],
    };
    mockProfileFindMany.mockResolvedValue([profileWithDropout]);

    const req = createNextRequest('http://localhost:3000/api/riders');
    const { data } = await parseResponse(await GET(req));

    expect(data.riders[0].ridesCompleted).toBe(1);
    expect(data.riders[0].totalKm).toBe(150);
  });

  it('returns cached ride role stats (pilot, sweep, organized) from profile', async () => {
    const profileWithStats = { ...mockProfile, pilotsDone: 3, sweepsDone: 2, ridesOrganized: 1 };
    mockProfileFindMany.mockResolvedValue([profileWithStats]);

    const req = createNextRequest('http://localhost:3000/api/riders');
    const { data } = await parseResponse(await GET(req));

    expect(data.riders[0].pilotsDone).toBe(3);
    expect(data.riders[0].sweepsDone).toBe(2);
    expect(data.riders[0].ridesOrganized).toBe(1);
  });
});

describe('POST /api/riders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 403 for unauthenticated users', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const req = createNextRequest('http://localhost:3000/api/riders', {
      method: 'POST',
      body: { name: 'New Rider' },
    });
    const { status, data } = await parseResponse(await POST(req));

    expect(status).toBe(403);
    expect(data.error).toBe('Forbidden');
  });

  it('returns 403 for regular riders', async () => {
    mockGetCurrentUser.mockResolvedValue(mockRider);

    const req = createNextRequest('http://localhost:3000/api/riders', {
      method: 'POST',
      body: { name: 'New Rider' },
    });
    const { status } = await parseResponse(await POST(req));

    expect(status).toBe(403);
  });

  it('returns 400 when name is missing', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);

    const req = createNextRequest('http://localhost:3000/api/riders', {
      method: 'POST',
      body: { email: 'new@t2w.com' },
    });
    const { status, data } = await parseResponse(await POST(req));

    expect(status).toBe(400);
    expect(data.error).toBe('Name is required');
  });

  it('creates rider profile for superadmin', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);
    const created = { id: 'rider-new', name: 'New Rider', email: 'new@t2w.com' };
    mockProfileCreate.mockResolvedValue(created);
    mockUserFindUnique.mockResolvedValue(null);

    const req = createNextRequest('http://localhost:3000/api/riders', {
      method: 'POST',
      body: { name: 'New Rider', email: 'new@t2w.com' },
    });
    const { status, data } = await parseResponse(await POST(req));

    expect(status).toBe(200);
    expect(data.profile.name).toBe('New Rider');
  });

  it('creates rider profile for core_member', async () => {
    mockGetCurrentUser.mockResolvedValue(mockCoreMember);
    const created = { id: 'rider-new', name: 'New Rider', email: '' };
    mockProfileCreate.mockResolvedValue(created);

    const req = createNextRequest('http://localhost:3000/api/riders', {
      method: 'POST',
      body: { name: 'New Rider' },
    });
    const { status } = await parseResponse(await POST(req));

    expect(status).toBe(200);
  });

  it('auto-links user when matching email exists', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);
    const created = { id: 'rider-new', name: 'New Rider', email: 'existing@t2w.com' };
    mockProfileCreate.mockResolvedValue(created);
    mockUserFindUnique.mockResolvedValue({ id: 'user-x', linkedRiderId: null });

    const req = createNextRequest('http://localhost:3000/api/riders', {
      method: 'POST',
      body: { name: 'New Rider', email: 'existing@t2w.com' },
    });
    await POST(req);

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-x' },
        data: { linkedRiderId: 'rider-new' },
      })
    );
  });
});

describe('GET /api/riders — emergency contact visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRolePermissions.mockResolvedValue(defaultRolePerms);
    mockProfileFindMany.mockResolvedValue([mockProfile]);
  });

  it('includes emergency contact for superadmin', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);

    const req = createNextRequest('http://localhost:3000/api/riders');
    const { status, data } = await parseResponse(await GET(req));

    expect(status).toBe(200);
    expect(data.riders[0].emergencyContact).toBe('Emergency Person');
    expect(data.riders[0].emergencyPhone).toBe('1234567890');
  });

  it('includes emergency contact for core_member', async () => {
    mockGetCurrentUser.mockResolvedValue(mockCoreMember);

    const req = createNextRequest('http://localhost:3000/api/riders');
    const { status, data } = await parseResponse(await GET(req));

    expect(status).toBe(200);
    expect(data.riders[0].emergencyContact).toBe('Emergency Person');
    expect(data.riders[0].emergencyPhone).toBe('1234567890');
  });

  it('strips emergency contact for t2w_rider even with canViewMemberDirectory enabled', async () => {
    mockGetCurrentUser.mockResolvedValue(mockT2WRider);
    mockGetRolePermissions.mockResolvedValue({
      ...defaultRolePerms,
      t2w_rider: { ...defaultRolePerms.t2w_rider, canViewMemberDirectory: true },
    });

    const req = createNextRequest('http://localhost:3000/api/riders');
    const { status, data } = await parseResponse(await GET(req));

    expect(status).toBe(200);
    expect(data.riders[0].emergencyContact).toBeUndefined();
    expect(data.riders[0].emergencyPhone).toBeUndefined();
  });
});

describe('GET /api/riders — public leaderboard access (canViewMemberDirectory no longer gates)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRolePermissions.mockResolvedValue(defaultRolePerms);
  });

  it('returns 200 for t2w_rider even when canViewMemberDirectory is disabled (public leaderboard access)', async () => {
    mockGetCurrentUser.mockResolvedValue(mockT2WRider);
    mockProfileFindMany.mockResolvedValue([mockProfile]);

    const req = createNextRequest('http://localhost:3000/api/riders');
    const { status } = await parseResponse(await GET(req));
    expect(status).toBe(200);
  });

  it('allows t2w_rider when canViewMemberDirectory is enabled', async () => {
    mockGetCurrentUser.mockResolvedValue(mockT2WRider);
    mockGetRolePermissions.mockResolvedValue({
      ...defaultRolePerms,
      t2w_rider: { ...defaultRolePerms.t2w_rider, canViewMemberDirectory: true },
    });
    mockProfileFindMany.mockResolvedValue([mockProfile]);

    const req = createNextRequest('http://localhost:3000/api/riders');
    const { status } = await parseResponse(await GET(req));
    expect(status).toBe(200);
  });

  it('returns 200 for plain rider (public leaderboard access, PII stripped)', async () => {
    mockGetCurrentUser.mockResolvedValue(mockRider);
    mockProfileFindMany.mockResolvedValue([mockProfile]);

    const req = createNextRequest('http://localhost:3000/api/riders');
    const { status } = await parseResponse(await GET(req));
    expect(status).toBe(200);
  });
});
