import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNextRequest, parseResponse, mockSuperAdmin, mockRider } from '@/__tests__/helpers';

vi.mock('@/lib/db', () => ({
  prisma: {
    content: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}));

import { GET, POST } from '@/app/api/content/route';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

const mockGetCurrentUser = getCurrentUser as ReturnType<typeof vi.fn>;
const mockFindMany = prisma.content.findMany as ReturnType<typeof vi.fn>;
const mockCreate = prisma.content.create as ReturnType<typeof vi.fn>;

describe('GET /api/content', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns all content items', async () => {
    const items = [
      { id: '1', title: 'Brand Logo', type: 'brand', status: 'published', lastUpdated: new Date() },
      { id: '2', title: 'Video', type: 'media', status: 'draft', lastUpdated: new Date() },
    ];
    mockFindMany.mockResolvedValue(items);

    const { status, data } = await parseResponse(await GET());

    expect(status).toBe(200);
    expect(data.content).toHaveLength(2);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { lastUpdated: 'desc' } })
    );
  });

  it('returns empty array on error', async () => {
    mockFindMany.mockRejectedValue(new Error('DB error'));

    const { data } = await parseResponse(await GET());

    expect(data.content).toEqual([]);
  });
});

describe('POST /api/content', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 403 for unauthenticated users', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const req = createNextRequest('http://localhost:3000/api/content', {
      method: 'POST',
      body: { title: 'New', type: 'brand' },
    });
    const { status } = await parseResponse(await POST(req));

    expect(status).toBe(403);
  });

  it('returns 403 for regular riders', async () => {
    mockGetCurrentUser.mockResolvedValue(mockRider);

    const req = createNextRequest('http://localhost:3000/api/content', {
      method: 'POST',
      body: { title: 'New', type: 'brand' },
    });
    const { status } = await parseResponse(await POST(req));

    expect(status).toBe(403);
  });

  it('returns 400 when title is missing', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);

    const req = createNextRequest('http://localhost:3000/api/content', {
      method: 'POST',
      body: { type: 'brand' },
    });
    const { status, data } = await parseResponse(await POST(req));

    expect(status).toBe(400);
    expect(data.error).toBe('Title and type required');
  });

  it('returns 400 when type is missing', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);

    const req = createNextRequest('http://localhost:3000/api/content', {
      method: 'POST',
      body: { title: 'New Content' },
    });
    const { status } = await parseResponse(await POST(req));

    expect(status).toBe(400);
  });

  it('creates content with default draft status', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);
    mockCreate.mockResolvedValue({ id: '1', title: 'New', type: 'brand', status: 'draft' });

    const req = createNextRequest('http://localhost:3000/api/content', {
      method: 'POST',
      body: { title: 'New', type: 'brand' },
    });
    const { status } = await parseResponse(await POST(req));

    expect(status).toBe(201);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'draft' }),
      })
    );
  });

  it('creates content with custom status', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);
    mockCreate.mockResolvedValue({ id: '1', title: 'New', type: 'brand', status: 'published' });

    const req = createNextRequest('http://localhost:3000/api/content', {
      method: 'POST',
      body: { title: 'New', type: 'brand', status: 'published' },
    });
    await POST(req);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'published' }),
      })
    );
  });
});
