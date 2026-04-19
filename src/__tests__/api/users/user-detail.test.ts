import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNextRequest } from '@/__tests__/helpers';

vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    riderProfile: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}));

import { GET, PUT, DELETE } from '@/app/api/users/[id]/route';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

const mockGetCurrentUser = getCurrentUser as ReturnType<typeof vi.fn>;
const mockUserFindUnique = prisma.user.findUnique as ReturnType<typeof vi.fn>;
const mockUserFindFirst = prisma.user.findFirst as ReturnType<typeof vi.fn>;
const mockUserUpdate = prisma.user.update as ReturnType<typeof vi.fn>;
const mockUserDelete = prisma.user.delete as ReturnType<typeof vi.fn>;
const mockRiderFindUnique = prisma.riderProfile.findUnique as ReturnType<typeof vi.fn>;

const SUPERADMIN = { id: 'admin-1', role: 'superadmin', email: 'admin@test.com' };
const CORE_MEMBER = { id: 'core-1', role: 'core_member' };
const RIDER_USER = { id: 'rider-1', role: 'rider' };

// Reflects only the fields returned by Prisma's `select` in GET /api/users/[id]
const BASE_USER = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  role: 'rider',
  isApproved: true,
  joinDate: new Date('2024-01-01'),
  linkedRiderId: null,
  phone: '1234567890',
  city: 'Bangalore',
  ridingExperience: '2 years',
  notifyRides: true,
  adminNotifySelected: false,
};

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

function callGET(id: string) {
  return GET(
    createNextRequest(`http://localhost:3000/api/users/${id}`),
    params(id)
  );
}

function callPUT(id: string, body: Record<string, unknown>) {
  return PUT(
    createNextRequest(`http://localhost:3000/api/users/${id}`, {
      method: 'PUT',
      body,
      headers: { 'Content-Type': 'application/json' },
    }),
    params(id)
  );
}

function callDELETE(id: string) {
  return DELETE(
    createNextRequest(`http://localhost:3000/api/users/${id}`, { method: 'DELETE' }),
    params(id)
  );
}

// ── GET /api/users/[id] ───────────────────────────────────────────────────

describe('GET /api/users/[id]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await callGET('user-1');
    expect(res.status).toBe(401);
  });

  it('returns 404 when user does not exist', async () => {
    mockGetCurrentUser.mockResolvedValue(CORE_MEMBER);
    mockUserFindUnique.mockResolvedValue(null);
    const res = await callGET('missing-id');
    expect(res.status).toBe(404);
  });

  it('returns user data without password field', async () => {
    mockGetCurrentUser.mockResolvedValue(CORE_MEMBER);
    mockUserFindUnique.mockResolvedValue(BASE_USER);
    const res = await callGET('user-1');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user).toBeDefined();
    expect(body.user).not.toHaveProperty('password');
    expect(body.user.name).toBe('Test User');
  });
});

// ── PUT /api/users/[id] ───────────────────────────────────────────────────

const FULL_USER = { ...BASE_USER, linkedRiderId: null, password: 'hashed', avatar: null, createdAt: new Date(), updatedAt: new Date() };

describe('PUT /api/users/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserFindUnique.mockResolvedValue(FULL_USER);
    mockUserUpdate.mockResolvedValue({ ...FULL_USER, name: 'Updated' });
    mockRiderFindUnique.mockResolvedValue(null);
  });

  it('returns 403 when unauthenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await callPUT('user-1', { name: 'X' });
    expect(res.status).toBe(403);
  });

  it('returns 403 for plain rider', async () => {
    mockGetCurrentUser.mockResolvedValue(RIDER_USER);
    const res = await callPUT('user-1', { name: 'X' });
    expect(res.status).toBe(403);
  });

  it('allows superadmin to update user name and role', async () => {
    mockGetCurrentUser.mockResolvedValue(SUPERADMIN);
    const res = await callPUT('user-1', { name: 'New Name', role: 't2w_rider' });
    expect(res.status).toBe(200);
    expect(mockUserUpdate).toHaveBeenCalled();
  });

  it('allows core_member to update basic user fields', async () => {
    mockGetCurrentUser.mockResolvedValue(CORE_MEMBER);
    const res = await callPUT('user-1', { name: 'New Name' });
    expect(res.status).toBe(200);
  });

  it('returns 400 for invalid role value', async () => {
    mockGetCurrentUser.mockResolvedValue(SUPERADMIN);
    const res = await callPUT('user-1', { role: 'invalid_role' });
    expect(res.status).toBe(400);
  });

  it('returns 403 when core_member tries to grant superadmin role', async () => {
    mockGetCurrentUser.mockResolvedValue(CORE_MEMBER);
    const res = await callPUT('user-1', { role: 'superadmin' });
    expect(res.status).toBe(403);
  });

  it('returns 403 when core_member tries to grant core_member role', async () => {
    mockGetCurrentUser.mockResolvedValue(CORE_MEMBER);
    const res = await callPUT('user-1', { role: 'core_member' });
    expect(res.status).toBe(403);
  });

  it('normalizes email to lowercase', async () => {
    mockGetCurrentUser.mockResolvedValue(SUPERADMIN);
    await callPUT('user-1', { email: 'Test@EXAMPLE.COM' });
    const call = mockUserUpdate.mock.calls[0][0];
    expect(call.data.email).toBe('test@example.com');
  });

  it('returns 404 when neither user nor rider profile found', async () => {
    mockGetCurrentUser.mockResolvedValue(SUPERADMIN);
    mockUserFindUnique.mockResolvedValue(null);
    mockRiderFindUnique.mockResolvedValue(null);
    const res = await callPUT('missing-id', { name: 'X' });
    expect(res.status).toBe(404);
  });
});

// ── DELETE /api/users/[id] ────────────────────────────────────────────────

describe('DELETE /api/users/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserFindUnique.mockResolvedValue(FULL_USER);
    mockUserDelete.mockResolvedValue({ id: 'user-1' });
    mockRiderFindUnique.mockResolvedValue(null);
    mockUserFindFirst.mockResolvedValue(null);
  });

  it('returns 403 when unauthenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await callDELETE('user-1');
    expect(res.status).toBe(403);
  });

  it('returns 403 for core_member (superadmin only)', async () => {
    mockGetCurrentUser.mockResolvedValue(CORE_MEMBER);
    const res = await callDELETE('user-1');
    expect(res.status).toBe(403);
  });

  it('allows superadmin to delete a user', async () => {
    mockGetCurrentUser.mockResolvedValue(SUPERADMIN);
    const res = await callDELETE('user-1');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockUserDelete).toHaveBeenCalledWith({ where: { id: 'user-1' } });
  });

  it('prevents deletion of protected admin accounts', async () => {
    mockGetCurrentUser.mockResolvedValue(SUPERADMIN);
    mockUserFindUnique.mockResolvedValue({
      ...FULL_USER,
      email: 'roshan.manuel@gmail.com',
    });
    const res = await callDELETE('user-1');
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/protected/i);
  });

  it('returns 404 when user and rider profile both not found', async () => {
    mockGetCurrentUser.mockResolvedValue(SUPERADMIN);
    mockUserFindUnique.mockResolvedValue(null);
    mockRiderFindUnique.mockResolvedValue(null);
    const res = await callDELETE('missing-id');
    expect(res.status).toBe(404);
  });

  it('returns 500 on DB error', async () => {
    mockGetCurrentUser.mockResolvedValue(SUPERADMIN);
    mockUserDelete.mockRejectedValue(new Error('DB error'));
    const res = await callDELETE('user-1');
    expect(res.status).toBe(500);
  });
});
