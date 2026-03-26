import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNextRequest, parseResponse, mockRider } from '@/__tests__/helpers';

vi.mock('@/lib/db', () => ({
  prisma: {
    motorcycle: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}));

import { GET, POST } from '@/app/api/motorcycles/route';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

const mockGetCurrentUser = getCurrentUser as ReturnType<typeof vi.fn>;
const mockFindMany = prisma.motorcycle.findMany as ReturnType<typeof vi.fn>;
const mockCreate = prisma.motorcycle.create as ReturnType<typeof vi.fn>;

describe('GET /api/motorcycles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 for unauthenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const { status, data } = await parseResponse(await GET());

    expect(status).toBe(401);
    expect(data.error).toBe('Not authenticated');
  });

  it('returns current user motorcycles only', async () => {
    mockGetCurrentUser.mockResolvedValue(mockRider);
    const motorcycles = [
      { id: 'm-1', make: 'Royal Enfield', model: 'Classic 350', year: 2022, cc: 350, color: 'Black', nickname: null, userId: mockRider.id },
    ];
    mockFindMany.mockResolvedValue(motorcycles);

    const { status, data } = await parseResponse(await GET());

    expect(status).toBe(200);
    expect(data.motorcycles).toHaveLength(1);
    expect(data.motorcycles[0].make).toBe('Royal Enfield');
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: mockRider.id },
      })
    );
  });
});

describe('POST /api/motorcycles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 for unauthenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const req = createNextRequest('http://localhost:3000/api/motorcycles', {
      method: 'POST',
      body: { make: 'Honda', model: 'CB500' },
    });
    const { status, data } = await parseResponse(await POST(req));

    expect(status).toBe(401);
    expect(data.error).toBe('Not authenticated');
  });

  it('returns 400 if make/model missing', async () => {
    mockGetCurrentUser.mockResolvedValue(mockRider);

    const req = createNextRequest('http://localhost:3000/api/motorcycles', {
      method: 'POST',
      body: { make: '', model: '' },
    });
    const { status, data } = await parseResponse(await POST(req));

    expect(status).toBe(400);
    expect(data.error).toContain('required');
  });

  it('creates motorcycle linked to current user', async () => {
    mockGetCurrentUser.mockResolvedValue(mockRider);
    const created = { id: 'm-new', make: 'Kawasaki', model: 'Ninja 400', year: 2024, cc: 400, color: 'Green', nickname: null, userId: mockRider.id };
    mockCreate.mockResolvedValue(created);

    const req = createNextRequest('http://localhost:3000/api/motorcycles', {
      method: 'POST',
      body: { make: 'Kawasaki', model: 'Ninja 400', year: 2024, cc: 400, color: 'Green' },
    });
    const { status, data } = await parseResponse(await POST(req));

    expect(status).toBe(200);
    expect(data.motorcycle.make).toBe('Kawasaki');
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: mockRider.id,
          make: 'Kawasaki',
          model: 'Ninja 400',
        }),
      })
    );
  });
});
