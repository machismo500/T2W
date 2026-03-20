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
      update: vi.fn(),
    },
    riderProfile: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    rideParticipation: {
      findMany: vi.fn(),
    },
  },
}));

// Mock auth functions
vi.mock('@/lib/auth', () => ({
  verifyPassword: vi.fn(),
  createToken: vi.fn().mockResolvedValue('mock-jwt-token'),
  setAuthCookie: vi.fn().mockResolvedValue(undefined),
}));

// Mock badge awarding
vi.mock('@/app/api/badges/route', () => ({
  awardBadgesForUser: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from '@/app/api/auth/login/route';
import { prisma } from '@/lib/db';
import { verifyPassword, setAuthCookie } from '@/lib/auth';
import { awardBadgesForUser } from '@/app/api/badges/route';

const mockUser = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  password: 'hashed-password',
  role: 'rider',
  isApproved: true,
  totalKm: 100,
  ridesCompleted: 2,
  linkedRiderId: null,
  joinDate: new Date('2024-01-01'),
  phone: null,
  city: null,
  ridingExperience: null,
  motorcycles: [],
  earnedBadges: [],
};

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when email is missing', async () => {
    const req = createNextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: { password: 'password123' },
    });

    const res = await POST(req);
    const { status, data } = await parseResponse(res);

    expect(status).toBe(400);
    expect(data.error).toBe('Email and password are required');
  });

  it('returns 400 when password is missing', async () => {
    const req = createNextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: { email: 'test@example.com' },
    });

    const res = await POST(req);
    const { status, data } = await parseResponse(res);

    expect(status).toBe(400);
    expect(data.error).toBe('Email and password are required');
  });

  it('returns 401 when user is not found', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const req = createNextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: { email: 'notfound@example.com', password: 'password123' },
    });

    const res = await POST(req);
    const { status, data } = await parseResponse(res);

    expect(status).toBe(401);
    expect(data.error).toBe('Invalid email or password');
  });

  it('returns 401 when password is invalid', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
    vi.mocked(verifyPassword).mockResolvedValue(false);

    const req = createNextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: { email: 'test@example.com', password: 'wrongpassword' },
    });

    const res = await POST(req);
    const { status, data } = await parseResponse(res);

    expect(status).toBe(401);
    expect(data.error).toBe('Invalid email or password');
  });

  it('returns 200 with user data on successful login', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
    vi.mocked(verifyPassword).mockResolvedValue(true);
    vi.mocked(prisma.riderProfile.findMany).mockResolvedValue([]);
    vi.mocked(prisma.rideParticipation.findMany).mockResolvedValue([]);

    const req = createNextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: { email: 'test@example.com', password: 'password123' },
    });

    const res = await POST(req);
    const { status, data } = await parseResponse(res);

    expect(status).toBe(200);
    expect(data.user).toBeDefined();
    expect(data.user.email).toBe('test@example.com');
    expect(data.user.password).toBeUndefined();
  });

  it('sets auth cookie on successful login', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
    vi.mocked(verifyPassword).mockResolvedValue(true);
    vi.mocked(prisma.riderProfile.findMany).mockResolvedValue([]);
    vi.mocked(prisma.rideParticipation.findMany).mockResolvedValue([]);

    const req = createNextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: { email: 'test@example.com', password: 'password123' },
    });

    await POST(req);

    expect(setAuthCookie).toHaveBeenCalledWith('mock-jwt-token');
  });

  it('normalizes email to lowercase', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const req = createNextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: { email: 'TEST@Example.COM', password: 'password123' },
    });

    await POST(req);

    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: 'test@example.com' },
      })
    );
  });

  it('calls awardBadgesForUser on successful login', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
    vi.mocked(verifyPassword).mockResolvedValue(true);
    vi.mocked(prisma.riderProfile.findMany).mockResolvedValue([]);
    vi.mocked(prisma.rideParticipation.findMany).mockResolvedValue([]);

    const req = createNextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: { email: 'test@example.com', password: 'password123' },
    });

    await POST(req);

    expect(awardBadgesForUser).toHaveBeenCalledWith(mockUser.id, mockUser.totalKm);
  });
});
