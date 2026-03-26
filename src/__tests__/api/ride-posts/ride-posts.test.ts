import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNextRequest, parseResponse, mockSuperAdmin, mockRider } from '@/__tests__/helpers';

vi.mock('@/lib/db', () => ({
  prisma: {
    ridePost: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}));

import { GET, POST } from '@/app/api/ride-posts/route';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

const mockGetCurrentUser = getCurrentUser as ReturnType<typeof vi.fn>;
const mockFindMany = prisma.ridePost.findMany as ReturnType<typeof vi.fn>;
const mockCreate = prisma.ridePost.create as ReturnType<typeof vi.fn>;

const mockPost = {
  id: 'post-1',
  rideId: 'ride-1',
  authorId: 'user-1',
  authorName: 'Test Author',
  content: 'Great ride!',
  images: '["img1.jpg","img2.jpg"]',
  approvalStatus: 'approved',
  approvedBy: 'Admin',
  createdAt: new Date('2025-01-15'),
};

describe('GET /api/ride-posts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns posts with parsed images', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    mockFindMany.mockResolvedValue([mockPost]);

    const req = createNextRequest('http://localhost:3000/api/ride-posts');
    const { status, data } = await parseResponse(await GET(req));

    expect(status).toBe(200);
    expect(data.posts).toHaveLength(1);
    expect(data.posts[0].images).toEqual(['img1.jpg', 'img2.jpg']);
    expect(data.posts[0].authorName).toBe('Test Author');
  });

  it('filters by rideId', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    mockFindMany.mockResolvedValue([]);

    const req = createNextRequest('http://localhost:3000/api/ride-posts?rideId=ride-1');
    await GET(req);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ rideId: 'ride-1' }),
      })
    );
  });

  it('filters by approval status', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    mockFindMany.mockResolvedValue([]);

    const req = createNextRequest('http://localhost:3000/api/ride-posts?status=approved');
    await GET(req);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ approvalStatus: 'approved' }),
      })
    );
  });

  it('non-admin users only see approved posts when no status filter', async () => {
    mockGetCurrentUser.mockResolvedValue(mockRider);
    mockFindMany.mockResolvedValue([]);

    const req = createNextRequest('http://localhost:3000/api/ride-posts');
    await GET(req);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ approvalStatus: 'approved' }),
      })
    );
  });

  it('admins can see all posts when no status filter', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);
    mockFindMany.mockResolvedValue([]);

    const req = createNextRequest('http://localhost:3000/api/ride-posts');
    await GET(req);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({ approvalStatus: expect.anything() }),
      })
    );
  });

  it('handles null images gracefully', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    mockFindMany.mockResolvedValue([{ ...mockPost, images: null }]);

    const req = createNextRequest('http://localhost:3000/api/ride-posts');
    const { data } = await parseResponse(await GET(req));

    expect(data.posts[0].images).toEqual([]);
  });
});

describe('POST /api/ride-posts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 for unauthenticated users', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const req = createNextRequest('http://localhost:3000/api/ride-posts', {
      method: 'POST',
      body: { rideId: 'ride-1', content: 'Post content' },
    });
    const { status, data } = await parseResponse(await POST(req));

    expect(status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('auto-approves posts by admin users', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);
    mockCreate.mockResolvedValue({
      ...mockPost,
      approvalStatus: 'approved',
      approvedBy: mockSuperAdmin.name,
    });

    const req = createNextRequest('http://localhost:3000/api/ride-posts', {
      method: 'POST',
      body: { rideId: 'ride-1', content: 'Admin post' },
    });
    const { status, data } = await parseResponse(await POST(req));

    expect(status).toBe(200);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          approvalStatus: 'approved',
          approvedBy: mockSuperAdmin.name,
        }),
      })
    );
  });

  it('creates pending post for regular users', async () => {
    mockGetCurrentUser.mockResolvedValue(mockRider);
    mockCreate.mockResolvedValue({
      ...mockPost,
      approvalStatus: 'pending',
      approvedBy: null,
    });

    const req = createNextRequest('http://localhost:3000/api/ride-posts', {
      method: 'POST',
      body: { rideId: 'ride-1', content: 'Rider post' },
    });
    await POST(req);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          approvalStatus: 'pending',
        }),
      })
    );
  });

  it('stringifies images array', async () => {
    mockGetCurrentUser.mockResolvedValue(mockRider);
    mockCreate.mockResolvedValue(mockPost);

    const req = createNextRequest('http://localhost:3000/api/ride-posts', {
      method: 'POST',
      body: { rideId: 'ride-1', content: 'Post', images: ['a.jpg', 'b.jpg'] },
    });
    await POST(req);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          images: JSON.stringify(['a.jpg', 'b.jpg']),
        }),
      })
    );
  });
});
