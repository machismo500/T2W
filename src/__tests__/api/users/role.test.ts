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

import { PUT } from '@/app/api/users/role/route';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

describe('PUT /api/users/role', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRolePermissions.mockResolvedValue(defaultRolePerms);
  });

  it('returns 401 for unauthenticated', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const req = createNextRequest('http://localhost:3000/api/users/role', {
      method: 'PUT',
      body: { userId: 'u2', newRole: 'rider' },
    });
    const { status } = await parseResponse(await PUT(req));
    expect(status).toBe(401);
  });

  it('returns 403 for core_member when canManageRoles is disabled (default)', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', role: 'core_member' } as any);

    const req = createNextRequest('http://localhost:3000/api/users/role', {
      method: 'PUT',
      body: { userId: 'u2', newRole: 'rider' },
    });
    const { status } = await parseResponse(await PUT(req));
    expect(status).toBe(403);
  });

  it('returns 400 for missing parameters', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', role: 'superadmin' } as any);

    const req = createNextRequest('http://localhost:3000/api/users/role', {
      method: 'PUT',
      body: { newRole: 'rider' },
    });
    const { status } = await parseResponse(await PUT(req));
    expect(status).toBe(400);
  });

  it('returns 400 for invalid role', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', role: 'superadmin' } as any);

    const req = createNextRequest('http://localhost:3000/api/users/role', {
      method: 'PUT',
      body: { userId: 'u2', newRole: 'invalid_role' },
    });
    const { status, data } = await parseResponse(await PUT(req));
    expect(status).toBe(400);
    expect(data.error).toContain('Invalid role');
  });

  it('updates user role by userId for superadmin', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', role: 'superadmin' } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'u2', linkedRiderId: 'r2' } as any);
    vi.mocked(prisma.user.update).mockResolvedValue({} as any);
    vi.mocked(prisma.riderProfile.update).mockResolvedValue({} as any);

    const req = createNextRequest('http://localhost:3000/api/users/role', {
      method: 'PUT',
      body: { userId: 'u2', newRole: 'core_member' },
    });
    const { status, data } = await parseResponse(await PUT(req));
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
    const { status } = await parseResponse(await PUT(req));
    expect(status).toBe(404);
  });

  it('updates rider profile by email when no user account', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', role: 'superadmin' } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.riderProfile.findMany).mockResolvedValue([{ id: 'r1', email: 'rider@t2w.com' }] as any);
    vi.mocked(prisma.riderProfile.update).mockResolvedValue({} as any);

    const req = createNextRequest('http://localhost:3000/api/users/role', {
      method: 'PUT',
      body: { email: 'rider@t2w.com', newRole: 't2w_rider' },
    });
    const { status, data } = await parseResponse(await PUT(req));
    expect(status).toBe(200);
    expect(data.updatedRider).toBe(true);
  });
});

describe('PUT /api/users/role — canManageRoles permission gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRolePermissions.mockResolvedValue(defaultRolePerms);
  });

  it('allows core_member to assign rider role when canManageRoles is enabled', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', role: 'core_member' } as any);
    mockGetRolePermissions.mockResolvedValue({
      ...defaultRolePerms,
      core_member: { ...defaultRolePerms.core_member, canManageRoles: true },
    });
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'u2', linkedRiderId: null } as any);
    vi.mocked(prisma.user.update).mockResolvedValue({} as any);

    const req = createNextRequest('http://localhost:3000/api/users/role', {
      method: 'PUT',
      body: { userId: 'u2', newRole: 'rider' },
    });
    const { status } = await parseResponse(await PUT(req));
    expect(status).toBe(200);
  });

  it('allows core_member to assign t2w_rider role when canManageRoles is enabled', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', role: 'core_member' } as any);
    mockGetRolePermissions.mockResolvedValue({
      ...defaultRolePerms,
      core_member: { ...defaultRolePerms.core_member, canManageRoles: true },
    });
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'u2', linkedRiderId: null } as any);
    vi.mocked(prisma.user.update).mockResolvedValue({} as any);

    const req = createNextRequest('http://localhost:3000/api/users/role', {
      method: 'PUT',
      body: { userId: 'u2', newRole: 't2w_rider' },
    });
    const { status } = await parseResponse(await PUT(req));
    expect(status).toBe(200);
  });

  it('blocks core_member from assigning core_member role even with canManageRoles', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', role: 'core_member' } as any);
    mockGetRolePermissions.mockResolvedValue({
      ...defaultRolePerms,
      core_member: { ...defaultRolePerms.core_member, canManageRoles: true },
    });

    const req = createNextRequest('http://localhost:3000/api/users/role', {
      method: 'PUT',
      body: { userId: 'u2', newRole: 'core_member' },
    });
    const { status, data } = await parseResponse(await PUT(req));
    expect(status).toBe(403);
    expect(data.error).toContain('rider or t2w_rider');
  });

  it('blocks core_member from assigning superadmin role even with canManageRoles', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', role: 'core_member' } as any);
    mockGetRolePermissions.mockResolvedValue({
      ...defaultRolePerms,
      core_member: { ...defaultRolePerms.core_member, canManageRoles: true },
    });

    const req = createNextRequest('http://localhost:3000/api/users/role', {
      method: 'PUT',
      body: { userId: 'u2', newRole: 'superadmin' },
    });
    const { status } = await parseResponse(await PUT(req));
    expect(status).toBe(403);
  });

  it('superadmin can assign any role without restriction', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', role: 'superadmin' } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'u2', linkedRiderId: null } as any);
    vi.mocked(prisma.user.update).mockResolvedValue({} as any);

    for (const role of ['rider', 't2w_rider', 'core_member', 'superadmin']) {
      vi.clearAllMocks();
      mockGetRolePermissions.mockResolvedValue(defaultRolePerms);
      vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', role: 'superadmin' } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'u2', linkedRiderId: null } as any);
      vi.mocked(prisma.user.update).mockResolvedValue({} as any);

      const req = createNextRequest('http://localhost:3000/api/users/role', {
        method: 'PUT',
        body: { userId: 'u2', newRole: role },
      });
      const { status } = await parseResponse(await PUT(req));
      expect(status).toBe(200);
    }
  });
});
