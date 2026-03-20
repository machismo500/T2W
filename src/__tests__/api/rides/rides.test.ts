import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNextRequest, parseResponse, mockSuperAdmin, mockCoreMember, mockRider } from '@/__tests__/helpers';

vi.mock('@/lib/db', () => ({
  prisma: {
    ride: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}));

import { GET, POST } from '@/app/api/rides/route';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

const mockGetCurrentUser = getCurrentUser as ReturnType<typeof vi.fn>;
const mockFindMany = prisma.ride.findMany as ReturnType<typeof vi.fn>;
const mockCount = prisma.ride.count as ReturnType<typeof vi.fn>;
const mockCreate = prisma.ride.create as ReturnType<typeof vi.fn>;

describe('GET /api/rides', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns rides (no auth required)', async () => {
    const rides = [
      {
        id: 'ride-1',
        title: 'Weekend Ride',
        rideNumber: '#001',
        type: 'day',
        status: 'upcoming',
        startDate: new Date('2025-04-01'),
        endDate: new Date('2025-04-01'),
        startLocation: 'Bangalore',
        startLocationUrl: null,
        endLocation: 'Mysore',
        endLocationUrl: null,
        route: '[]',
        distanceKm: 150,
        maxRiders: 30,
        difficulty: 'moderate',
        description: 'A fun ride',
        highlights: '[]',
        posterUrl: null,
        fee: 0,
        leadRider: 'Lead',
        sweepRider: 'Sweep',
        organisedBy: null,
        accountsBy: null,
        meetupTime: null,
        rideStartTime: null,
        startingPoint: null,
        riders: null,
        regOpenCore: null,
        regOpenT2w: null,
        regOpenRider: null,
        participations: [],
        registrations: [],
      },
    ];
    mockFindMany.mockResolvedValue(rides);

    const req = createNextRequest('http://localhost:3000/api/rides');
    const { status, data } = await parseResponse(await GET(req));

    expect(status).toBe(200);
    expect(data.rides).toHaveLength(1);
    expect(data.rides[0].title).toBe('Weekend Ride');
  });

  it('filters by ?status=upcoming', async () => {
    mockFindMany.mockResolvedValue([]);

    const req = createNextRequest('http://localhost:3000/api/rides?status=upcoming');
    await GET(req);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'upcoming' },
      })
    );
  });

  it('respects ?limit=5', async () => {
    mockFindMany.mockResolvedValue([]);

    const req = createNextRequest('http://localhost:3000/api/rides?limit=5');
    await GET(req);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 5,
      })
    );
  });
});

describe('POST /api/rides', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 403 for non-admin', async () => {
    mockGetCurrentUser.mockResolvedValue(mockRider);

    const req = createNextRequest('http://localhost:3000/api/rides', {
      method: 'POST',
      body: { title: 'New Ride' },
    });
    const { status, data } = await parseResponse(await POST(req));

    expect(status).toBe(403);
    expect(data.error).toBe('Forbidden');
  });

  it('returns 403 for unauthenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const req = createNextRequest('http://localhost:3000/api/rides', {
      method: 'POST',
      body: { title: 'New Ride' },
    });
    const { status } = await parseResponse(await POST(req));

    expect(status).toBe(403);
  });

  it('creates ride with auto-generated ride number', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);
    mockCount.mockResolvedValue(7);
    const createdRide = { id: 'ride-new', title: 'New Ride', rideNumber: '#008' };
    mockCreate.mockResolvedValue(createdRide);

    const req = createNextRequest('http://localhost:3000/api/rides', {
      method: 'POST',
      body: {
        title: 'New Ride',
        startDate: '2025-05-01',
        endDate: '2025-05-01',
        startLocation: 'Bangalore',
        endLocation: 'Goa',
      },
    });
    const { status, data } = await parseResponse(await POST(req));

    expect(status).toBe(200);
    expect(mockCount).toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rideNumber: '#008',
        }),
      })
    );
  });

  it('allows core_member to create rides', async () => {
    mockGetCurrentUser.mockResolvedValue(mockCoreMember);
    mockCount.mockResolvedValue(0);
    mockCreate.mockResolvedValue({ id: 'ride-2', title: 'Core Ride', rideNumber: '#001' });

    const req = createNextRequest('http://localhost:3000/api/rides', {
      method: 'POST',
      body: {
        title: 'Core Ride',
        startDate: '2025-06-01',
        endDate: '2025-06-01',
        startLocation: 'Chennai',
        endLocation: 'Pondicherry',
      },
    });
    const { status } = await parseResponse(await POST(req));

    expect(status).toBe(200);
  });
});
