import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNextRequest } from '@/__tests__/helpers';

vi.mock('@/lib/db', () => ({
  prisma: {
    blogPost: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}));

import { GET, PUT, DELETE } from '@/app/api/blogs/[id]/route';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

const mockGetCurrentUser = getCurrentUser as ReturnType<typeof vi.fn>;
const mockFindUnique = prisma.blogPost.findUnique as ReturnType<typeof vi.fn>;
const mockUpdate = prisma.blogPost.update as ReturnType<typeof vi.fn>;
const mockDelete = prisma.blogPost.delete as ReturnType<typeof vi.fn>;

const SUPERADMIN = { id: 'admin-1', role: 'superadmin' };
const CORE_MEMBER = { id: 'core-1', role: 'core_member' };
const RIDER = { id: 'rider-1', role: 'rider' };

const BASE_BLOG = {
  id: 'blog-1',
  title: 'Test Blog',
  excerpt: 'An excerpt',
  content: 'Blog content',
  authorName: 'Author',
  authorAvatar: null,
  publishDate: new Date('2025-01-01'),
  coverImage: null,
  tags: '["tag1","tag2"]',
  type: 'post',
  isVlog: false,
  videoUrl: null,
  readTime: 5,
  approvalStatus: 'approved',
};

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

function callGET(id: string) {
  return GET(
    createNextRequest(`http://localhost:3000/api/blogs/${id}`),
    params(id)
  );
}

function callPUT(id: string, body: Record<string, unknown>) {
  return PUT(
    createNextRequest(`http://localhost:3000/api/blogs/${id}`, {
      method: 'PUT',
      body,
      headers: { 'Content-Type': 'application/json' },
    }),
    params(id)
  );
}

function callDELETE(id: string) {
  return DELETE(
    createNextRequest(`http://localhost:3000/api/blogs/${id}`, { method: 'DELETE' }),
    params(id)
  );
}

// ── GET /api/blogs/[id] ───────────────────────────────────────────────────

describe('GET /api/blogs/[id]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 404 when blog not found', async () => {
    mockFindUnique.mockResolvedValue(null);
    const res = await callGET('missing-id');
    expect(res.status).toBe(404);
  });

  it('returns blog with parsed tags', async () => {
    mockFindUnique.mockResolvedValue(BASE_BLOG);
    const res = await callGET('blog-1');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.blog.tags).toEqual(['tag1', 'tag2']);
    expect(body.blog.title).toBe('Test Blog');
  });

  it('returns empty tags array when tags is null', async () => {
    mockFindUnique.mockResolvedValue({ ...BASE_BLOG, tags: null });
    const res = await callGET('blog-1');
    const body = await res.json();
    expect(body.blog.tags).toEqual([]);
  });

  it('returns 500 on DB error', async () => {
    mockFindUnique.mockRejectedValue(new Error('DB error'));
    const res = await callGET('blog-1');
    expect(res.status).toBe(500);
  });
});

// ── PUT /api/blogs/[id] ───────────────────────────────────────────────────

describe('PUT /api/blogs/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockResolvedValue({ ...BASE_BLOG, title: 'Updated' });
  });

  it('returns 403 when unauthenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await callPUT('blog-1', { title: 'X' });
    expect(res.status).toBe(403);
  });

  it('returns 403 for plain rider', async () => {
    mockGetCurrentUser.mockResolvedValue(RIDER);
    const res = await callPUT('blog-1', { title: 'X' });
    expect(res.status).toBe(403);
  });

  it('allows superadmin to update blog', async () => {
    mockGetCurrentUser.mockResolvedValue(SUPERADMIN);
    const res = await callPUT('blog-1', { title: 'Updated Title' });
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'blog-1' },
        data: expect.objectContaining({ title: 'Updated Title' }),
      })
    );
  });

  it('allows core_member to update blog', async () => {
    mockGetCurrentUser.mockResolvedValue(CORE_MEMBER);
    const res = await callPUT('blog-1', { excerpt: 'New excerpt' });
    expect(res.status).toBe(200);
  });

  it('stringifies tags array before saving', async () => {
    mockGetCurrentUser.mockResolvedValue(SUPERADMIN);
    await callPUT('blog-1', { tags: ['alpha', 'beta'] });
    const call = mockUpdate.mock.calls[0][0];
    expect(call.data.tags).toBe('["alpha","beta"]');
  });

  it('converts publishDate string to Date', async () => {
    mockGetCurrentUser.mockResolvedValue(SUPERADMIN);
    await callPUT('blog-1', { publishDate: '2025-06-01' });
    const call = mockUpdate.mock.calls[0][0];
    expect(call.data.publishDate).toBeInstanceOf(Date);
  });

  it('ignores unknown fields (mass-assignment protection)', async () => {
    mockGetCurrentUser.mockResolvedValue(SUPERADMIN);
    await callPUT('blog-1', { title: 'X', secretField: 'hack' });
    const call = mockUpdate.mock.calls[0][0];
    expect(call.data).not.toHaveProperty('secretField');
  });

  it('returns 500 on DB error', async () => {
    mockGetCurrentUser.mockResolvedValue(SUPERADMIN);
    mockUpdate.mockRejectedValue(new Error('DB error'));
    const res = await callPUT('blog-1', { title: 'X' });
    expect(res.status).toBe(500);
  });
});

// ── DELETE /api/blogs/[id] ────────────────────────────────────────────────

describe('DELETE /api/blogs/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDelete.mockResolvedValue({ id: 'blog-1' });
  });

  it('returns 403 when unauthenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await callDELETE('blog-1');
    expect(res.status).toBe(403);
  });

  it('returns 403 for plain rider', async () => {
    mockGetCurrentUser.mockResolvedValue(RIDER);
    const res = await callDELETE('blog-1');
    expect(res.status).toBe(403);
  });

  it('allows superadmin to delete blog', async () => {
    mockGetCurrentUser.mockResolvedValue(SUPERADMIN);
    const res = await callDELETE('blog-1');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: 'blog-1' } });
  });

  it('allows core_member to delete blog', async () => {
    mockGetCurrentUser.mockResolvedValue(CORE_MEMBER);
    const res = await callDELETE('blog-1');
    expect(res.status).toBe(200);
  });

  it('returns 500 on DB error', async () => {
    mockGetCurrentUser.mockResolvedValue(SUPERADMIN);
    mockDelete.mockRejectedValue(new Error('DB error'));
    const res = await callDELETE('blog-1');
    expect(res.status).toBe(500);
  });
});
