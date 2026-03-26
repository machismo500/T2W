import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNextRequest, parseResponse } from '@/__tests__/helpers';

vi.mock('@/lib/db', () => ({
  prisma: {
    blogPost: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { GET, POST } from '@/app/api/blogs/route';
import { prisma } from '@/lib/db';

const mockFindMany = prisma.blogPost.findMany as ReturnType<typeof vi.fn>;
const mockCreate = prisma.blogPost.create as ReturnType<typeof vi.fn>;

describe('GET /api/blogs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
  });

  it('creates blog with stringified tags', async () => {
    const created = {
      id: 'blog-new',
      title: 'New Blog',
      excerpt: 'Summary',
      content: 'Content here',
      authorName: 'Author',
      tags: '["travel"]',
    };
    mockCreate.mockResolvedValue(created);

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
