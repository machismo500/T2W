import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseResponse } from '@/__tests__/helpers';

// Mock next/headers
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue({ value: 'mock-token' }),
    set: vi.fn(),
    delete: vi.fn(),
  }),
}));

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

// Mock auth functions
vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}));

import { GET } from '@/app/api/auth/me/route';
import { getCurrentUser } from '@/lib/auth';

const mockUser = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  role: 'rider',
  isApproved: true,
  totalKm: 100,
  ridesCompleted: 2,
  linkedRiderId: 'rider-1',
  joinDate: new Date('2024-01-01'),
  motorcycles: [],
  earnedBadges: [],
};

describe('GET /api/auth/me', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when user is not authenticated', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const res = await GET();
    const { status, data } = await parseResponse(res);

    expect(status).toBe(401);
    expect(data.error).toBe('Not authenticated');
  });

  it('returns 200 with user data when authenticated', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any);

    const res = await GET();
    const { status, data } = await parseResponse(res);

    expect(status).toBe(200);
    expect(data.user).toBeDefined();
    expect(data.user.id).toBe('user-1');
    expect(data.user.email).toBe('test@example.com');
  });

  it('returns 500 when getCurrentUser throws', async () => {
    vi.mocked(getCurrentUser).mockRejectedValueOnce(new Error('DB error'));

    const res = await GET();
    const { status, data } = await parseResponse(res);

    expect(status).toBe(500);
    expect(data.error).toBe('Something went wrong');
  });
});
