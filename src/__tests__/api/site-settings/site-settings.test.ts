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
    mockFindUnique.mockResolvedValue({
      key: 'hero_stats',
      value: JSON.stringify({ riders: 500, rides: 50 }),
    });

    const req = createNextRequest('http://localhost:3000/api/site-settings?key=hero_stats');
    const { status, data } = await parseResponse(await GET(req));

    expect(status).toBe(200);
    expect(data.value).toEqual({ riders: 500, rides: 50 });
  });

  it('returns null for non-existent key', async () => {
    mockFindUnique.mockResolvedValue(null);

    const req = createNextRequest('http://localhost:3000/api/site-settings?key=nonexistent');
    const { status, data } = await parseResponse(await GET(req));

    expect(status).toBe(200);
    expect(data.value).toBeNull();
  });

  it('returns 500 on error', async () => {
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
