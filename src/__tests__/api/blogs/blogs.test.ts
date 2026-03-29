import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNextRequest, parseResponse, mockSuperAdmin, mockRider, mockT2WRider, mockCoreMember } from '@/__tests__/helpers';

vi.mock('@/lib/db', () => ({
  prisma: {
    blogPost: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}));

// Default: all permissions enabled (matching DEFAULT_ROLE_PERMISSIONS)
const defaultPermissions = {
  rider: { canRegisterForRides: true, canEditOwnProfile: true },
  t2w_rider: { canPostBlog: true, canPostRideTales: true, earlyRegistrationAccess: true },
  core_member: { canCreateRide: true, canEditRide: true, canManageRegistrations: true, canExportRegistrations: true, canControlLiveTracking: true, canApproveContent: true, canApproveUsers: true },
};

const { mockGetRolePermissions } = vi.hoisted(() => ({
  mockGetRolePermissions: vi.fn(),
}));

vi.mock('@/lib/role-permissions', () => ({
  getRolePermissions: mockGetRolePermissions,
}));

import { GET, POST } from '@/app/api/blogs/route';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

const mockGetCurrentUser = getCurrentUser as ReturnType<typeof vi.fn>;
const mockFindMany = prisma.blogPost.findMany as ReturnType<typeof vi.fn>;
const mockCreate = prisma.blogPost.create as ReturnType<typeof vi.fn>;

const mockBlogCreated = {
  id: 'blog-new',
  title: 'New Blog',
  excerpt: 'Summary',
  content: 'Content here',
  authorName: 'Author',
  tags: '["travel"]',
};

describe('GET /api/blogs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRolePermissions.mockResolvedValue(defaultPermissions);
  });

  it('returns blog list with parsed tags', async () => {
    const posts = [
      {
        id: 'blog-1',
        title: 'First Ride',
        excerpt: 'A great ride',
        content: 'Full story...',
        authorName: 'Admin',
        tags: '["adventure","touring"]',
        publishDate: new Date('2025-01-15'),
      },
      {
        id: 'blog-2',
        title: 'Second Ride',
        excerpt: 'Another ride',
        content: 'More story...',
        authorName: 'Writer',
        tags: null,
        publishDate: new Date('2025-02-20'),
      },
    ];
    mockFindMany.mockResolvedValue(posts);

    const { status, data } = await parseResponse(await GET());

    expect(status).toBe(200);
    expect(data.blogs).toHaveLength(2);
    expect(data.blogs[0].tags).toEqual(['adventure', 'touring']);
    expect(data.blogs[1].tags).toEqual([]);
  });
});

describe('POST /api/blogs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRolePermissions.mockResolvedValue(defaultPermissions);
  });

  it('returns 401 for unauthenticated users', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const req = createNextRequest('http://localhost:3000/api/blogs', {
      method: 'POST',
      body: { title: 'Test', content: 'Hello' },
    });
    const { status, data } = await parseResponse(await POST(req));

    expect(status).toBe(401);
    expect(data.error).toBe('Unauthorized');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns 403 for plain rider (cannot post blogs)', async () => {
    mockGetCurrentUser.mockResolvedValue(mockRider);

    const req = createNextRequest('http://localhost:3000/api/blogs', {
      method: 'POST',
      body: { title: 'Test', content: 'Hello' },
    });
    const { status } = await parseResponse(await POST(req));

    expect(status).toBe(403);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('allows t2w_rider to post when canPostBlog is enabled', async () => {
    mockGetCurrentUser.mockResolvedValue(mockT2WRider);
    mockCreate.mockResolvedValue(mockBlogCreated);

    const req = createNextRequest('http://localhost:3000/api/blogs', {
      method: 'POST',
      body: { title: 'New Blog', authorName: 'T2W Rider', tags: ['travel'] },
    });
    const { status } = await parseResponse(await POST(req));

    expect(status).toBe(200);
    expect(mockCreate).toHaveBeenCalled();
  });

  it('blocks t2w_rider when canPostBlog is disabled', async () => {
    mockGetCurrentUser.mockResolvedValue(mockT2WRider);
    mockGetRolePermissions.mockResolvedValue({
      ...defaultPermissions,
      t2w_rider: { ...defaultPermissions.t2w_rider, canPostBlog: false },
    });

    const req = createNextRequest('http://localhost:3000/api/blogs', {
      method: 'POST',
      body: { title: 'Test', content: 'Hello' },
    });
    const { status } = await parseResponse(await POST(req));

    expect(status).toBe(403);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('allows core_member to post regardless of t2w_rider permission', async () => {
    mockGetCurrentUser.mockResolvedValue(mockCoreMember);
    mockGetRolePermissions.mockResolvedValue({
      ...defaultPermissions,
      t2w_rider: { ...defaultPermissions.t2w_rider, canPostBlog: false },
    });
    mockCreate.mockResolvedValue(mockBlogCreated);

    const req = createNextRequest('http://localhost:3000/api/blogs', {
      method: 'POST',
      body: { title: 'Core Blog', authorName: 'Core Member', tags: [] },
    });
    const { status } = await parseResponse(await POST(req));

    expect(status).toBe(200);
  });

  it('allows superadmin to post regardless of any permission setting', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);
    mockGetRolePermissions.mockResolvedValue({
      ...defaultPermissions,
      t2w_rider: { ...defaultPermissions.t2w_rider, canPostBlog: false },
    });
    mockCreate.mockResolvedValue(mockBlogCreated);

    const req = createNextRequest('http://localhost:3000/api/blogs', {
      method: 'POST',
      body: { title: 'Admin Blog', authorName: 'Admin', tags: ['travel'] },
    });
    const { status } = await parseResponse(await POST(req));

    expect(status).toBe(200);
  });

  it('creates blog with stringified tags', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);
    mockCreate.mockResolvedValue(mockBlogCreated);

    const req = createNextRequest('http://localhost:3000/api/blogs', {
      method: 'POST',
      body: {
        title: 'New Blog',
        excerpt: 'Summary',
        content: 'Content here',
        authorName: 'Author',
        tags: ['travel'],
      },
    });
    const { status, data } = await parseResponse(await POST(req));

    expect(status).toBe(200);
    expect(data.blog.title).toBe('New Blog');
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tags: JSON.stringify(['travel']),
        }),
      })
    );
  });
});
