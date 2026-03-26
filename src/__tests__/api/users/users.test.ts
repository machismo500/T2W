import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNextRequest, parseResponse, mockSuperAdmin, mockCoreMember, mockRider } from '@/__tests__/helpers';

vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    riderProfile: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
  hashPassword: vi.fn().mockResolvedValue('hashed-password'),
}));

import { GET, POST } from '@/app/api/users/route';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

const mockGetCurrentUser = getCurrentUser as ReturnType<typeof vi.fn>;
const mockFindMany = prisma.user.findMany as ReturnType<typeof vi.fn>;
const mockFindUnique = prisma.user.findUnique as ReturnType<typeof vi.fn>;
const mockCreate = prisma.user.create as ReturnType<typeof vi.fn>;
const mockRiderFindMany = prisma.riderProfile.findMany as ReturnType<typeof vi.fn>;

describe('GET /api/users', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 403 for unauthenticated users', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const req = createNextRequest('http://localhost:3000/api/users');
    const { status, data } = await parseResponse(await GET(req));

    expect(status).toBe(403);
    expect(data.error).toBe('Forbidden');
  });

  it('returns 403 for non-admin role (rider)', async () => {
    mockGetCurrentUser.mockResolvedValue(mockRider);

    const req = createNextRequest('http://localhost:3000/api/users');
    const { status, data } = await parseResponse(await GET(req));

    expect(status).toBe(403);
    expect(data.error).toBe('Forbidden');
  });

  it('returns user list for superadmin', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);
    const users = [
      { id: '1', name: 'User One', email: 'one@test.com', role: 'rider', isApproved: true, joinDate: new Date('2024-06-01'), createdAt: new Date('2024-06-01'), linkedRiderId: null, phone: null, city: null, ridingExperience: null },
    ];
    mockFindMany.mockResolvedValue(users);
    mockRiderFindMany.mockResolvedValue([]);

    const req = createNextRequest('http://localhost:3000/api/users');
    const { status, data } = await parseResponse(await GET(req));

    expect(status).toBe(200);
    expect(data.users).toHaveLength(1);
    expect(data.totalUsers).toBe(1);
  });

  it('returns user list for core_member', async () => {
    mockGetCurrentUser.mockResolvedValue(mockCoreMember);
    mockFindMany.mockResolvedValue([]);
    mockRiderFindMany.mockResolvedValue([]);

    const req = createNextRequest('http://localhost:3000/api/users');
    const { status, data } = await parseResponse(await GET(req));

    expect(status).toBe(200);
    expect(data.users).toEqual([]);
  });

  it('filters by ?status=pending', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);
    mockFindMany.mockResolvedValue([]);

    const req = createNextRequest('http://localhost:3000/api/users?status=pending');
    await GET(req);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isApproved: false },
      })
    );
  });
});

describe('POST /api/users', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 403 for non-superadmin', async () => {
    mockGetCurrentUser.mockResolvedValue(mockCoreMember);

    const req = createNextRequest('http://localhost:3000/api/users', {
      method: 'POST',
      body: { name: 'New User', email: 'new@test.com' },
    });
    const { status, data } = await parseResponse(await POST(req));

    expect(status).toBe(403);
    expect(data.error).toBe('Forbidden');
  });

  it('returns 400 for missing name/email', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);

    const req = createNextRequest('http://localhost:3000/api/users', {
      method: 'POST',
      body: { name: '', email: '' },
    });
    const { status, data } = await parseResponse(await POST(req));

    expect(status).toBe(400);
    expect(data.error).toContain('required');
  });

  it('returns 409 for existing email', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);
    mockFindUnique.mockResolvedValue({ id: 'existing', email: 'dup@test.com' });

    const req = createNextRequest('http://localhost:3000/api/users', {
      method: 'POST',
      body: { name: 'Dup User', email: 'dup@test.com' },
    });
    const { status, data } = await parseResponse(await POST(req));

    expect(status).toBe(409);
    expect(data.error).toContain('already exists');
  });

  it('creates user on success', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: 'new-1', name: 'New User', email: 'new@test.com' });

    const req = createNextRequest('http://localhost:3000/api/users', {
      method: 'POST',
      body: { name: 'New User', email: 'new@test.com' },
    });
    const { status, data } = await parseResponse(await POST(req));

    expect(status).toBe(200);
    expect(data.user.name).toBe('New User');
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });
});
