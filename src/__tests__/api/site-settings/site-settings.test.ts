import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNextRequest, parseResponse, mockSuperAdmin, mockRider } from '@/__tests__/helpers';

vi.mock('@/lib/db', () => ({
  prisma: {
    siteSettings: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}));

const { mockInvalidateCache } = vi.hoisted(() => ({
  mockInvalidateCache: vi.fn(),
}));

vi.mock('@/lib/role-permissions', () => ({
  invalidateRolePermissionsCache: mockInvalidateCache,
}));

import { GET, PUT } from '@/app/api/site-settings/route';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

const mockGetCurrentUser = getCurrentUser as ReturnType<typeof vi.fn>;
const mockFindUnique = prisma.siteSettings.findUnique as ReturnType<typeof vi.fn>;
const mockUpsert = prisma.siteSettings.upsert as ReturnType<typeof vi.fn>;

describe('GET /api/site-settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when key is missing', async () => {
    const req = createNextRequest('http://localhost:3000/api/site-settings');
    const { status, data } = await parseResponse(await GET(req));

    expect(status).toBe(400);
    expect(data.error).toBe('Key required');
  });

  it('returns parsed JSON value for existing key', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);
    mockFindUnique.mockResolvedValue({
      key: 'hero_stats',
      value: JSON.stringify({ riders: 500, rides: 50 }),
    });

    const req = createNextRequest('http://localhost:3000/api/site-settings?key=hero_stats');
    const { status, data } = await parseResponse(await GET(req));

    expect(status).toBe(200);
    expect(data.value).toEqual({ riders: 500, rides: 50 });
  });

  it('returns parsed JSON value for public key without auth', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    mockFindUnique.mockResolvedValue({
      key: 'arena_weights',
      value: JSON.stringify({ ptsDay: 5 }),
    });

    const req = createNextRequest('http://localhost:3000/api/site-settings?key=arena_weights');
    const { status, data } = await parseResponse(await GET(req));

    expect(status).toBe(200);
    expect(data.value).toEqual({ ptsDay: 5 });
  });

  it('returns 403 for non-public key without auth', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const req = createNextRequest('http://localhost:3000/api/site-settings?key=hero_stats');
    const { status, data } = await parseResponse(await GET(req));

    expect(status).toBe(403);
    expect(data.error).toBe('Forbidden');
  });

  it('returns null for non-existent key', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);
    mockFindUnique.mockResolvedValue(null);

    const req = createNextRequest('http://localhost:3000/api/site-settings?key=nonexistent');
    const { status, data } = await parseResponse(await GET(req));

    expect(status).toBe(200);
    expect(data.value).toBeNull();
  });

  it('returns 500 on error', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);
    mockFindUnique.mockRejectedValue(new Error('DB error'));

    const req = createNextRequest('http://localhost:3000/api/site-settings?key=test');
    const { status, data } = await parseResponse(await GET(req));

    expect(status).toBe(500);
    expect(data.error).toBe('Failed to fetch setting');
  });
});

describe('PUT /api/site-settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 403 for unauthenticated users', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const req = createNextRequest('http://localhost:3000/api/site-settings', {
      method: 'PUT',
      body: { key: 'test', value: 'data' },
    });
    const { status } = await parseResponse(await PUT(req));

    expect(status).toBe(403);
  });

  it('returns 403 for regular riders', async () => {
    mockGetCurrentUser.mockResolvedValue(mockRider);

    const req = createNextRequest('http://localhost:3000/api/site-settings', {
      method: 'PUT',
      body: { key: 'test', value: 'data' },
    });
    const { status } = await parseResponse(await PUT(req));

    expect(status).toBe(403);
  });

  it('returns 400 when key is missing', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);

    const req = createNextRequest('http://localhost:3000/api/site-settings', {
      method: 'PUT',
      body: { value: 'data' },
    });
    const { status, data } = await parseResponse(await PUT(req));

    expect(status).toBe(400);
    expect(data.error).toBe('Key required');
  });

  it('upserts setting for admin users', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);
    mockUpsert.mockResolvedValue({ key: 'hero_stats', value: '{"riders":600}' });

    const req = createNextRequest('http://localhost:3000/api/site-settings', {
      method: 'PUT',
      body: { key: 'hero_stats', value: { riders: 600 } },
    });
    const { status, data } = await parseResponse(await PUT(req));

    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: 'hero_stats' },
        update: { value: JSON.stringify({ riders: 600 }) },
        create: { key: 'hero_stats', value: JSON.stringify({ riders: 600 }) },
      })
    );
  });
});

describe('role_permissions public key', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns role_permissions without authentication', async () => {
    (getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.siteSettings.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      key: 'role_permissions',
      value: JSON.stringify({ rider: { canRegisterForRides: false } }),
    });

    const req = createNextRequest('http://localhost:3000/api/site-settings?key=role_permissions');
    const { status, data } = await parseResponse(await GET(req));

    expect(status).toBe(200);
    expect(data.value.rider.canRegisterForRides).toBe(false);
  });

  it('invalidates role permissions cache when role_permissions key is saved', async () => {
    (getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue(mockSuperAdmin);
    (prisma.siteSettings.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const req = createNextRequest('http://localhost:3000/api/site-settings', {
      method: 'PUT',
      body: { key: 'role_permissions', value: { rider: { canRegisterForRides: false } } },
    });
    await PUT(req);

    expect(mockInvalidateCache).toHaveBeenCalled();
  });

  it('does NOT invalidate cache when saving a different key', async () => {
    (getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue(mockSuperAdmin);
    (prisma.siteSettings.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const req = createNextRequest('http://localhost:3000/api/site-settings', {
      method: 'PUT',
      body: { key: 'arena_weights', value: { ptsDay: 5 } },
    });
    await PUT(req);

    expect(mockInvalidateCache).not.toHaveBeenCalled();
  });
});
