import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseResponse } from '@/__tests__/helpers';

vi.mock('@/lib/db', () => ({
  prisma: {
    riderProfile: {
      count: vi.fn(),
    },
    ride: {
      count: vi.fn(),
      aggregate: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { GET } from '@/app/api/stats/route';
import { prisma } from '@/lib/db';

const mockRiderCount = prisma.riderProfile.count as ReturnType<typeof vi.fn>;
const mockRideCount = prisma.ride.count as ReturnType<typeof vi.fn>;
const mockRideAggregate = prisma.ride.aggregate as ReturnType<typeof vi.fn>;
const mockRideFindMany = prisma.ride.findMany as ReturnType<typeof vi.fn>;

describe('GET /api/stats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns aggregated statistics', async () => {
    mockRiderCount.mockResolvedValue(42);
    mockRideCount.mockResolvedValue(15);
    mockRideAggregate.mockResolvedValue({ _sum: { distanceKm: 12500.7 } });
    mockRideFindMany.mockResolvedValue([
      { startLocation: 'Bangalore, Karnataka', endLocation: 'Kathmandu, Nepal' },
      { startLocation: 'Chennai', endLocation: 'Pondicherry' },
    ]);

    const { status, data } = await parseResponse(await GET());

    expect(status).toBe(200);
    expect(data.activeRiders).toBe(42);
    expect(data.ridesCompleted).toBe(15);
    expect(data.kmsCovered).toBe(12501); // rounded
    // India is always counted + Nepal detected from location
    expect(data.countriesRidden).toBe(2);
  });

  it('returns fallback values on error', async () => {
    mockRiderCount.mockRejectedValue(new Error('DB down'));

    const { status, data } = await parseResponse(await GET());

    expect(status).toBe(200);
    expect(data.activeRiders).toBe(0);
    expect(data.ridesCompleted).toBe(0);
    expect(data.kmsCovered).toBe(0);
    expect(data.countriesRidden).toBe(0);
  });
});
