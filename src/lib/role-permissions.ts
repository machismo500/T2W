/**
 * Dynamic role-based feature permissions.
 * Super admins can toggle these on/off per role via the admin panel.
 * Stored in SiteSettings with key "role_permissions".
 */

export type RolePermissions = {
  rider: {
    canRegisterForRides: boolean;
    canEditOwnProfile: boolean;
    canViewLiveTracking: boolean;
    canDownloadRideDocuments: boolean;
  };
  t2w_rider: {
    canPostBlog: boolean;
    canPostRideTales: boolean;
    earlyRegistrationAccess: boolean;
    canViewMemberDirectory: boolean;
  };
  core_member: {
    canCreateRide: boolean;
    canEditRide: boolean;
    canManageRegistrations: boolean;
    canExportRegistrations: boolean;
    canControlLiveTracking: boolean;
    canApproveContent: boolean;
    canApproveUsers: boolean;
    canViewActivityLog: boolean;
    canManageRoles: boolean;
    canManageBadges: boolean;
  };
};

export const DEFAULT_ROLE_PERMISSIONS: RolePermissions = {
  rider: {
    canRegisterForRides: true,
    canEditOwnProfile: true,
    canViewLiveTracking: true,
    canDownloadRideDocuments: false,
  },
  t2w_rider: {
    canPostBlog: true,
    canPostRideTales: true,
    earlyRegistrationAccess: true,
    canViewMemberDirectory: false,
  },
  core_member: {
    canCreateRide: true,
    canEditRide: true,
    canManageRegistrations: true,
    canExportRegistrations: true,
    canControlLiveTracking: true,
    canApproveContent: true,
    canApproveUsers: true,
    canViewActivityLog: true,
    canManageRoles: false,
    canManageBadges: false,
  },
};

// ---------------------------------------------------------------------------
// Server-side cached fetcher (used by API routes).
// Cache for 5 minutes to avoid a DB read on every request.
// ---------------------------------------------------------------------------
let _cache: RolePermissions | null = null;
let _cacheExpiry = 0;

export async function getRolePermissions(): Promise<RolePermissions> {
  const now = Date.now();
  if (_cache && now < _cacheExpiry) return _cache;
  try {
    const { prisma } = await import("@/lib/db");
    const row = await prisma.siteSettings.findUnique({ where: { key: "role_permissions" } });
    const parsed = row ? (JSON.parse(row.value) as Partial<RolePermissions>) : {};
    _cache = {
      rider:       { ...DEFAULT_ROLE_PERMISSIONS.rider,       ...parsed.rider },
      t2w_rider:   { ...DEFAULT_ROLE_PERMISSIONS.t2w_rider,   ...parsed.t2w_rider },
      core_member: { ...DEFAULT_ROLE_PERMISSIONS.core_member, ...parsed.core_member },
    };
  } catch {
    _cache = DEFAULT_ROLE_PERMISSIONS;
  }
  _cacheExpiry = now + 5 * 60 * 1000;
  return _cache;
}

/** Invalidate the server-side cache (call after saving new permissions). */
export function invalidateRolePermissionsCache() {
  _cache = null;
  _cacheExpiry = 0;
}
