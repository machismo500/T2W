import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNextRequest, parseResponse } from '@/__tests__/helpers';

// Mock next/headers
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  }),
}));

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    riderProfile: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    motorcycle: {
      create: vi.fn(),
    },
  },
}));

// Mock auth functions
vi.mock('@/lib/auth', () => ({
  hashPassword: vi.fn().mockResolvedValue('hashed-password'),
  createToken: vi.fn().mockResolvedValue('mock-jwt-token'),
  setAuthCookie: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from '@/app/api/auth/register/route';
import { prisma } from '@/lib/db';
import { setAuthCookie } from '@/lib/auth';

const mockCreatedUser = {
  id: 'user-new',
  name: 'New User',
  email: 'new@example.com',
  password: 'hashed-password',
  role: 'rider',
  isApproved: false,
  totalKm: 0,
  ridesCompleted: 0,
  linkedRiderId: null,
  joinDate: new Date('2024-06-01'),
  phone: null,
  city: null,
  ridingExperience: null,
  motorcycles: [],
  earnedBadges: [],
};

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no existing user (first call), then re-fetch returns created user (second call)
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce(null)              // check for existing account
      .mockResolvedValueOnce(mockCreatedUser as any); // re-fetch after creation
    vi.mocked(prisma.riderProfile.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockResolvedValue(mockCreatedUser as any);
    vi.mocked(prisma.riderProfile.create).mockResolvedValue({ id: 'profile-new', name: 'New User', email: 'new@example.com', phone: '' } as any);
    vi.mocked(prisma.user.update).mockResolvedValue(mockCreatedUser as any);
  });

  it('returns 400 when name is missing', async () => {
    const req = createNextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: { email: 'new@example.com', password: 'securepassword1' },
    });

    const res = await POST(req);
    const { status, data } = await parseResponse(res);

    expect(status).toBe(400);
    expect(data.error).toBe('Name, email, and password are required');
  });

  it('returns 400 when email is missing', async () => {
    const req = createNextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: { name: 'New User', password: 'securepassword1' },
    });

    const res = await POST(req);
    const { status, data } = await parseResponse(res);

    expect(status).toBe(400);
    expect(data.error).toBe('Name, email, and password are required');
  });

  it('returns 400 when password is missing', async () => {
    const req = createNextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: { name: 'New User', email: 'new@example.com' },
    });

    const res = await POST(req);
    const { status, data } = await parseResponse(res);

    expect(status).toBe(400);
    expect(data.error).toBe('Name, email, and password are required');
  });

  it('returns 400 when password is too short', async () => {
    const req = createNextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: { name: 'New User', email: 'new@example.com', password: '11charpassw' },
    });

    const res = await POST(req);
    const { status, data } = await parseResponse(res);

    expect(status).toBe(400);
    expect(data.error).toBe('Password must be at least 12 characters');
  });

  it('returns 409 when email already exists', async () => {
    // Reset and set first findUnique to return existing user
    vi.mocked(prisma.user.findUnique).mockReset();
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ id: 'existing-user', email: 'new@example.com' } as any);

    const req = createNextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: { name: 'New User', email: 'new@example.com', password: 'securepassword1' },
    });

    const res = await POST(req);
    const { status, data } = await parseResponse(res);

    expect(status).toBe(409);
    expect(data.existingAccount).toBe(true);
  });

  it('returns 200 with user data on successful registration', async () => {
    const req = createNextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: { name: 'New User', email: 'new@example.com', password: 'securepassword1' },
    });

    const res = await POST(req);
    const { status, data } = await parseResponse(res);

    expect(status).toBe(200);
    expect(data.user).toBeDefined();
    expect(data.user.email).toBe('new@example.com');
    expect(data.user.password).toBeUndefined();
  });

  it('sets auth cookie on successful registration', async () => {
    const req = createNextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: { name: 'New User', email: 'new@example.com', password: 'securepassword1' },
    });

    await POST(req);

    expect(setAuthCookie).toHaveBeenCalledWith('mock-jwt-token');
  });

  it('creates rider profile when none exists', async () => {
    vi.mocked(prisma.riderProfile.findFirst).mockResolvedValue(null);

    const req = createNextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: { name: 'New User', email: 'new@example.com', password: 'securepassword1' },
    });

    await POST(req);

    expect(prisma.riderProfile.create).toHaveBeenCalledWith({
      data: {
        name: 'New User',
        email: 'new@example.com',
        phone: '',
      },
    });
  });

  it('does not create rider profile when one already exists', async () => {
    const existingProfile = {
      id: 'profile-existing',
      name: 'Existing Rider',
      email: 'new@example.com',
      mergedIntoId: null,
      participations: [],
    };
    vi.mocked(prisma.riderProfile.findFirst).mockResolvedValue(existingProfile as any);

    const req = createNextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: { name: 'New User', email: 'new@example.com', password: 'securepassword1' },
    });

    await POST(req);

    expect(prisma.riderProfile.create).not.toHaveBeenCalled();
  });

  it('creates motorcycle when provided', async () => {
    vi.mocked(prisma.motorcycle.create).mockResolvedValue({} as any);

    const req = createNextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: {
        name: 'New User',
        email: 'new@example.com',
        password: 'securepassword1',
        motorcycle: 'Honda CB500',
      },
    });

    await POST(req);

    expect(prisma.motorcycle.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        make: 'Honda CB500',
        userId: 'user-new',
      }),
    });
  });

  it('does not create motorcycle when not provided', async () => {
    const req = createNextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: { name: 'New User', email: 'new@example.com', password: 'securepassword1' },
    });

    await POST(req);

    expect(prisma.motorcycle.create).not.toHaveBeenCalled();
  });
});
