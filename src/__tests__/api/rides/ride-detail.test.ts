import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNextRequest, parseResponse } from '@/__tests__/helpers';

vi.mock('@/lib/db', () => ({
  prisma: {
    ride: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}));

import { GET } from '@/app/api/rides/[id]/route';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

const mockGetCurrentUser = getCurrentUser as ReturnType<typeof vi.fn>;
const mockFindUnique = prisma.ride.findUnique as ReturnType<typeof vi.fn>;

function callGET(rideId: string) {
  const req = createNextRequest(`http://localhost:3000/api/rides/${rideId}`);
  return GET(req, { params: Promise.resolve({ id: rideId }) });
}

const baseRideDb = {
  id: 'ride-1',
  title: 'Test Ride',
  rideNumber: '#001',
  type: 'day',
  status: 'upcoming',
  startDate: new Date('2025-06-01'),
  endDate: new Date('2025-06-01'),
  startLocation: 'Bangalore',
  startLocationUrl: null,
  endLocation: 'Mysore',
  endLocationUrl: null,
  route: '["Bangalore","Mysore"]',
  distanceKm: 150,
  maxRiders: 10,
  difficulty: 'moderate',
  description: 'A test ride',
  highlights: '[]',
  posterUrl: null,
  fee: 500,
  leadRider: 'Lead',
  sweepRider: 'Sweep',
  organisedBy: null,
  accountsBy: null,
  meetupTime: null,
  rideStartTime: null,
  startingPoint: null,
  riders: null,
  regFormSettings: null,
  regOpenCore: null,
  regOpenT2w: null,
  regOpenRider: null,
  participations: [],
  registrations: [],
};

describe('GET /api/rides/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(null); // default: not logged in
  });

  it('returns 404 when ride not found', async () => {
    mockFindUnique.mockResolvedValue(null);

    const { status, data } = await parseResponse(await callGET('nonexistent'));

    expect(status).toBe(404);
    expect(data.error).toBe('Ride not found');
  });

  it('returns ride data with correct fields', async () => {
    mockFindUnique.mockResolvedValue({ ...baseRideDb });

    const { status, data } = await parseResponse(await callGET('ride-1'));

    expect(status).toBe(200);
    expect(data.ride.id).toBe('ride-1');
    expect(data.ride.title).toBe('Test Ride');
    expect(data.ride.maxRiders).toBe(10);
    expect(data.ride.route).toEqual(['Bangalore', 'Mysore']);
  });

  // ── registeredRiders counts only confirmed ──

  it('registeredRiders counts only confirmed registrations', async () => {
    mockFindUnique.mockResolvedValue({
      ...baseRideDb,
      registrations: [
        { id: 'r1', userId: 'u1', confirmationCode: 'C1', approvalStatus: 'confirmed', riderName: 'A' },
        { id: 'r2', userId: 'u2', confirmationCode: 'C2', approvalStatus: 'confirmed', riderName: 'B' },
        { id: 'r3', userId: 'u3', confirmationCode: 'C3', approvalStatus: 'pending', riderName: 'C' },
        { id: 'r4', userId: 'u4', confirmationCode: 'C4', approvalStatus: 'dropout', riderName: 'D' },
        { id: 'r5', userId: 'u5', confirmationCode: 'C5', approvalStatus: 'rejected', riderName: 'E' },
      ],
    });

    const { data } = await parseResponse(await callGET('ride-1'));

    expect(data.ride.registeredRiders).toBe(2); // only confirmed
  });

  // ── activeRegistrations counts pending + confirmed ──

  it('activeRegistrations counts pending + confirmed registrations', async () => {
    mockFindUnique.mockResolvedValue({
      ...baseRideDb,
      registrations: [
        { id: 'r1', userId: 'u1', confirmationCode: 'C1', approvalStatus: 'confirmed', riderName: 'A' },
        { id: 'r2', userId: 'u2', confirmationCode: 'C2', approvalStatus: 'confirmed', riderName: 'B' },
        { id: 'r3', userId: 'u3', confirmationCode: 'C3', approvalStatus: 'pending', riderName: 'C' },
        { id: 'r4', userId: 'u4', confirmationCode: 'C4', approvalStatus: 'dropout', riderName: 'D' },
        { id: 'r5', userId: 'u5', confirmationCode: 'C5', approvalStatus: 'rejected', riderName: 'E' },
      ],
    });

    const { data } = await parseResponse(await callGET('ride-1'));

    expect(data.ride.activeRegistrations).toBe(3); // 2 confirmed + 1 pending
  });

  it('activeRegistrations is 0 when all registrations are dropout/rejected', async () => {
    mockFindUnique.mockResolvedValue({
      ...baseRideDb,
      registrations: [
        { id: 'r1', userId: 'u1', confirmationCode: 'C1', approvalStatus: 'dropout', riderName: 'A' },
        { id: 'r2', userId: 'u2', confirmationCode: 'C2', approvalStatus: 'rejected', riderName: 'B' },
        { id: 'r3', userId: 'u3', confirmationCode: 'C3', approvalStatus: 'dropout', riderName: 'C' },
      ],
    });

    const { data } = await parseResponse(await callGET('ride-1'));

    expect(data.ride.registeredRiders).toBe(0);
    expect(data.ride.activeRegistrations).toBe(0);
  });

  it('activeRegistrations equals registeredRiders when no pending/dropout/rejected', async () => {
    mockFindUnique.mockResolvedValue({
      ...baseRideDb,
      registrations: [
        { id: 'r1', userId: 'u1', confirmationCode: 'C1', approvalStatus: 'confirmed', riderName: 'A' },
        { id: 'r2', userId: 'u2', confirmationCode: 'C2', approvalStatus: 'confirmed', riderName: 'B' },
      ],
    });

    const { data } = await parseResponse(await callGET('ride-1'));

    expect(data.ride.registeredRiders).toBe(2);
    expect(data.ride.activeRegistrations).toBe(2);
  });

  // ── confirmedRiderNames only includes confirmed riders ──

  it('confirmedRiderNames only lists confirmed rider names', async () => {
    mockFindUnique.mockResolvedValue({
      ...baseRideDb,
      registrations: [
        { id: 'r1', userId: 'u1', confirmationCode: 'C1', approvalStatus: 'confirmed', riderName: 'Alice' },
        { id: 'r2', userId: 'u2', confirmationCode: 'C2', approvalStatus: 'pending', riderName: 'Bob' },
        { id: 'r3', userId: 'u3', confirmationCode: 'C3', approvalStatus: 'dropout', riderName: 'Charlie' },
        { id: 'r4', userId: 'u4', confirmationCode: 'C4', approvalStatus: 'confirmed', riderName: 'Diana' },
      ],
    });

    const { data } = await parseResponse(await callGET('ride-1'));

    expect(data.ride.confirmedRiderNames).toEqual(['Alice', 'Diana']);
  });

  // ── Empty registrations ──

  it('handles ride with zero registrations', async () => {
    mockFindUnique.mockResolvedValue({
      ...baseRideDb,
      registrations: [],
    });

    const { data } = await parseResponse(await callGET('ride-1'));

    expect(data.ride.registeredRiders).toBe(0);
    expect(data.ride.activeRegistrations).toBe(0);
    expect(data.ride.confirmedRiderNames).toEqual([]);
  });

  // ── Fallback logic for registeredRiders / activeRegistrations ──

  it('falls back to participations count when no confirmed registrations', async () => {
    mockFindUnique.mockResolvedValue({
      ...baseRideDb,
      registrations: [],
      participations: [
        { id: 'p1', riderProfile: { id: 'rp1', name: 'Alice', avatarUrl: null }, droppedOut: false, points: 5 },
        { id: 'p2', riderProfile: { id: 'rp2', name: 'Bob', avatarUrl: null }, droppedOut: false, points: 3 },
      ],
    });

    const { data } = await parseResponse(await callGET('ride-1'));

    expect(data.ride.registeredRiders).toBe(2);
    expect(data.ride.activeRegistrations).toBe(2);
  });

  it('falls back to riders JSON when no registrations or participations', async () => {
    mockFindUnique.mockResolvedValue({
      ...baseRideDb,
      registrations: [],
      participations: [],
      riders: '["Alice","Bob"]',
    });

    const { data } = await parseResponse(await callGET('ride-1'));

    expect(data.ride.registeredRiders).toBe(2);
    expect(data.ride.activeRegistrations).toBe(2);
  });
});
