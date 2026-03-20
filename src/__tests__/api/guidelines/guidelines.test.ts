import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNextRequest, parseResponse } from '@/__tests__/helpers';

vi.mock('@/lib/db', () => ({
  prisma: {
    guideline: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { GET, POST } from '@/app/api/guidelines/route';
import { prisma } from '@/lib/db';

const mockFindMany = prisma.guideline.findMany as ReturnType<typeof vi.fn>;
const mockCreate = prisma.guideline.create as ReturnType<typeof vi.fn>;

describe('GET /api/guidelines', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns all guidelines ordered by id', async () => {
    const guidelines = [
      { id: '1', title: 'Safety First', content: 'Always wear helmet', category: 'safety', icon: 'shield' },
      { id: '2', title: 'Group Rules', content: 'Stay in formation', category: 'group', icon: 'users' },
    ];
    mockFindMany.mockResolvedValue(guidelines);

    const { status, data } = await parseResponse(await GET());

    expect(status).toBe(200);
    expect(data.guidelines).toHaveLength(2);
    expect(data.guidelines[0].title).toBe('Safety First');
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { id: 'asc' } })
    );
  });

  it('returns 500 on error', async () => {
    mockFindMany.mockRejectedValue(new Error('DB error'));

    const { status, data } = await parseResponse(await GET());

    expect(status).toBe(500);
    expect(data.error).toBe('Failed to load guidelines');
  });
});

describe('POST /api/guidelines', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a new guideline', async () => {
    const created = {
      id: '3',
      title: 'New Rule',
      content: 'Follow the leader',
      category: 'group',
      icon: 'flag',
    };
    mockCreate.mockResolvedValue(created);

    const req = createNextRequest('http://localhost:3000/api/guidelines', {
      method: 'POST',
      body: { title: 'New Rule', content: 'Follow the leader', category: 'group', icon: 'flag' },
    });
    const { status, data } = await parseResponse(await POST(req));

    expect(status).toBe(200);
    expect(data.guideline.title).toBe('New Rule');
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          title: 'New Rule',
          content: 'Follow the leader',
          category: 'group',
          icon: 'flag',
        },
      })
    );
  });

  it('returns 500 on creation error', async () => {
    mockCreate.mockRejectedValue(new Error('DB error'));

    const req = createNextRequest('http://localhost:3000/api/guidelines', {
      method: 'POST',
      body: { title: 'Test', content: 'Test', category: 'general', icon: 'star' },
    });
    const { status, data } = await parseResponse(await POST(req));

    expect(status).toBe(500);
    expect(data.error).toBe('Failed to create guideline');
  });
});
