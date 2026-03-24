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
        startDate: new Date(Date.now() + 7 * 86400000),
        endDate: new Date(Date.now() + 10 * 86400000),
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

  it('returns activeRegistrations counting only pending + confirmed', async () => {
    const rides = [
      {
        id: 'ride-1',
        title: 'Test Ride',
        rideNumber: '#001',
        type: 'day',
        status: 'upcoming',
        startDate: new Date(Date.now() + 7 * 86400000),
        endDate: new Date(Date.now() + 10 * 86400000),
        startLocation: 'A',
        startLocationUrl: null,
        endLocation: 'B',
        endLocationUrl: null,
        route: '[]',
        distanceKm: 100,
        maxRiders: 10,
        difficulty: 'easy',
        description: 'Test',
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
        registrations: [
          { id: 'r1', approvalStatus: 'confirmed' },
          { id: 'r2', approvalStatus: 'confirmed' },
          { id: 'r3', approvalStatus: 'pending' },
          { id: 'r4', approvalStatus: 'dropout' },
          { id: 'r5', approvalStatus: 'rejected' },
        ],
      },
    ];
    mockFindMany.mockResolvedValue(rides);

    const req = createNextRequest('http://localhost:3000/api/rides');
    const { data } = await parseResponse(await GET(req));

    expect(data.rides[0].registeredRiders).toBe(2);       // only confirmed
    expect(data.rides[0].activeRegistrations).toBe(3);     // pending + confirmed
  });

  it('filters by ?status=upcoming (dynamic)', async () => {
    const futureStart = new Date(Date.now() + 7 * 86400000);
    const futureEnd = new Date(Date.now() + 10 * 86400000);
    const pastStart = new Date(Date.now() - 10 * 86400000);
    const pastEnd = new Date(Date.now() - 3 * 86400000);

    const rides = [
      {
        id: 'ride-upcoming', title: 'Upcoming', rideNumber: '#001', type: 'day', status: 'upcoming',
        startDate: futureStart, endDate: futureEnd,
        startLocation: 'A', startLocationUrl: null, endLocation: 'B', endLocationUrl: null,
        route: '[]', distanceKm: 100, maxRiders: 10, difficulty: 'easy',
        description: '', highlights: '[]', posterUrl: null, fee: 0,
        leadRider: '', sweepRider: '', organisedBy: null, accountsBy: null,
        meetupTime: null, rideStartTime: null, startingPoint: null, riders: null,
        regOpenCore: null, regOpenT2w: null, regOpenRider: null,
        participations: [], registrations: [],
      },
      {
        id: 'ride-past', title: 'Past Ride', rideNumber: '#002', type: 'day', status: 'upcoming',
        startDate: pastStart, endDate: pastEnd,
        startLocation: 'C', startLocationUrl: null, endLocation: 'D', endLocationUrl: null,
        route: '[]', distanceKm: 200, maxRiders: 10, difficulty: 'easy',
        description: '', highlights: '[]', posterUrl: null, fee: 0,
        leadRider: '', sweepRider: '', organisedBy: null, accountsBy: null,
        meetupTime: null, rideStartTime: null, startingPoint: null, riders: null,
        regOpenCore: null, regOpenT2w: null, regOpenRider: null,
        participations: [], registrations: [],
      },
    ];
    mockFindMany.mockResolvedValue(rides);

    const req = createNextRequest('http://localhost:3000/api/rides?status=upcoming');
    const { data } = await parseResponse(await GET(req));

    // Only the future ride should be returned as "upcoming"
    expect(data.rides).toHaveLength(1);
    expect(data.rides[0].id).toBe('ride-upcoming');
  });

  it('respects ?limit=1', async () => {
    const futureStart = new Date(Date.now() + 7 * 86400000);
    const futureEnd = new Date(Date.now() + 10 * 86400000);

    const rides = [
      {
        id: 'ride-a', title: 'Ride A', rideNumber: '#001', type: 'day', status: 'upcoming',
        startDate: futureStart, endDate: futureEnd,
        startLocation: 'A', startLocationUrl: null, endLocation: 'B', endLocationUrl: null,
        route: '[]', distanceKm: 100, maxRiders: 10, difficulty: 'easy',
        description: '', highlights: '[]', posterUrl: null, fee: 0,
        leadRider: '', sweepRider: '', organisedBy: null, accountsBy: null,
        meetupTime: null, rideStartTime: null, startingPoint: null, riders: null,
        regOpenCore: null, regOpenT2w: null, regOpenRider: null,
        participations: [], registrations: [],
      },
      {
        id: 'ride-b', title: 'Ride B', rideNumber: '#002', type: 'day', status: 'upcoming',
        startDate: futureStart, endDate: futureEnd,
        startLocation: 'C', startLocationUrl: null, endLocation: 'D', endLocationUrl: null,
        route: '[]', distanceKm: 200, maxRiders: 10, difficulty: 'easy',
        description: '', highlights: '[]', posterUrl: null, fee: 0,
        leadRider: '', sweepRider: '', organisedBy: null, accountsBy: null,
        meetupTime: null, rideStartTime: null, startingPoint: null, riders: null,
        regOpenCore: null, regOpenT2w: null, regOpenRider: null,
        participations: [], registrations: [],
      },
    ];
    mockFindMany.mockResolvedValue(rides);

    const req = createNextRequest('http://localhost:3000/api/rides?limit=1');
    const { data } = await parseResponse(await GET(req));

    expect(data.rides).toHaveLength(1);
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
