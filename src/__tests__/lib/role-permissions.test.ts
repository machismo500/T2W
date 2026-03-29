import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  prisma: {
    siteSettings: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/db';
import {
  DEFAULT_ROLE_PERMISSIONS,
  getRolePermissions,
  invalidateRolePermissionsCache,
} from '@/lib/role-permissions';

const mockFindUnique = prisma.siteSettings.findUnique as ReturnType<typeof vi.fn>;

describe('DEFAULT_ROLE_PERMISSIONS', () => {
  it('has all rider permissions enabled', () => {
    expect(DEFAULT_ROLE_PERMISSIONS.rider.canRegisterForRides).toBe(true);
    expect(DEFAULT_ROLE_PERMISSIONS.rider.canEditOwnProfile).toBe(true);
  });

  it('has all t2w_rider permissions enabled', () => {
    expect(DEFAULT_ROLE_PERMISSIONS.t2w_rider.canPostBlog).toBe(true);
    expect(DEFAULT_ROLE_PERMISSIONS.t2w_rider.canPostRideTales).toBe(true);
    expect(DEFAULT_ROLE_PERMISSIONS.t2w_rider.earlyRegistrationAccess).toBe(true);
  });

  it('has all core_member permissions enabled', () => {
    const { core_member } = DEFAULT_ROLE_PERMISSIONS;
    expect(core_member.canCreateRide).toBe(true);
    expect(core_member.canEditRide).toBe(true);
    expect(core_member.canManageRegistrations).toBe(true);
    expect(core_member.canExportRegistrations).toBe(true);
    expect(core_member.canControlLiveTracking).toBe(true);
    expect(core_member.canApproveContent).toBe(true);
    expect(core_member.canApproveUsers).toBe(true);
  });
});

describe('getRolePermissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateRolePermissionsCache(); // reset cache between tests
  });

  it('returns defaults when no DB row exists', async () => {
    mockFindUnique.mockResolvedValue(null);

    const perms = await getRolePermissions();

    expect(perms).toEqual(DEFAULT_ROLE_PERMISSIONS);
    expect(mockFindUnique).toHaveBeenCalledWith({ where: { key: 'role_permissions' } });
  });

  it('merges DB overrides with defaults', async () => {
    mockFindUnique.mockResolvedValue({
      key: 'role_permissions',
      value: JSON.stringify({
        t2w_rider: { canPostBlog: false },
        core_member: { canCreateRide: false },
      }),
    });

    const perms = await getRolePermissions();

    // Override applied
    expect(perms.t2w_rider.canPostBlog).toBe(false);
    expect(perms.core_member.canCreateRide).toBe(false);
    // Other fields remain at default
    expect(perms.t2w_rider.canPostRideTales).toBe(true);
    expect(perms.core_member.canEditRide).toBe(true);
    expect(perms.rider.canRegisterForRides).toBe(true);
  });

  it('uses cached result on second call within window', async () => {
    mockFindUnique.mockResolvedValue(null);

    await getRolePermissions();
    await getRolePermissions();

    // DB should only be hit once due to caching
    expect(mockFindUnique).toHaveBeenCalledTimes(1);
  });

  it('re-fetches from DB after cache is invalidated', async () => {
    mockFindUnique.mockResolvedValue(null);

    await getRolePermissions();
    invalidateRolePermissionsCache();
    await getRolePermissions();

    expect(mockFindUnique).toHaveBeenCalledTimes(2);
  });

  it('falls back to defaults when DB throws', async () => {
    mockFindUnique.mockRejectedValue(new Error('DB connection failed'));

    const perms = await getRolePermissions();

    expect(perms).toEqual(DEFAULT_ROLE_PERMISSIONS);
  });

  it('does not lose unspecified role sections when DB only overrides one role', async () => {
    mockFindUnique.mockResolvedValue({
      key: 'role_permissions',
      value: JSON.stringify({ rider: { canRegisterForRides: false } }),
    });

    const perms = await getRolePermissions();

    expect(perms.rider.canRegisterForRides).toBe(false);
    // Other role groups should be defaults
    expect(perms.t2w_rider).toEqual(DEFAULT_ROLE_PERMISSIONS.t2w_rider);
    expect(perms.core_member).toEqual(DEFAULT_ROLE_PERMISSIONS.core_member);
  });
});

describe('invalidateRolePermissionsCache', () => {
  it('forces a fresh DB read on next getRolePermissions call', async () => {
    mockFindUnique.mockResolvedValue(null);

    await getRolePermissions(); // fills cache
    invalidateRolePermissionsCache();
    await getRolePermissions(); // should re-fetch

    expect(mockFindUnique).toHaveBeenCalledTimes(2);
  });
});
