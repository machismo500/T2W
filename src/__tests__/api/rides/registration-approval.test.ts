import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNextRequest, parseResponse, mockSuperAdmin, mockCoreMember, mockRider } from '@/__tests__/helpers';

vi.mock('@/lib/db', () => ({
  prisma: {
    rideRegistration: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    rideParticipation: {
      upsert: vi.fn(),
      updateMany: vi.fn(),
    },
    ride: {
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}));

import { PATCH } from '@/app/api/rides/[id]/registrations/[regId]/route';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

const mockGetCurrentUser = getCurrentUser as ReturnType<typeof vi.fn>;
const mockFindFirst = prisma.rideRegistration.findFirst as ReturnType<typeof vi.fn>;
const mockFindMany = prisma.rideRegistration.findMany as ReturnType<typeof vi.fn>;
const mockUpdate = prisma.rideRegistration.update as ReturnType<typeof vi.fn>;
const mockUserFindUnique = prisma.user.findUnique as ReturnType<typeof vi.fn>;
const mockParticipationUpsert = prisma.rideParticipation.upsert as ReturnType<typeof vi.fn>;
const mockParticipationUpdateMany = prisma.rideParticipation.updateMany as ReturnType<typeof vi.fn>;
const mockRideUpdate = prisma.ride.update as ReturnType<typeof vi.fn>;

function callPATCH(rideId: string, regId: string, body: Record<string, unknown>) {
  const req = createNextRequest(`http://localhost:3000/api/rides/${rideId}/registrations/${regId}`, {
    method: 'PATCH',
    body,
  });
  return PATCH(req, { params: Promise.resolve({ id: rideId, regId }) });
}

/** Helper: set up mocks so syncRideRidersFromRegistrations works correctly */
function mockSyncReturningNames(names: string[]) {
  mockFindMany.mockResolvedValue(names.map((n) => ({ riderName: n })));
  mockRideUpdate.mockResolvedValue({});
}

describe('PATCH /api/rides/[id]/registrations/[regId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSyncReturningNames([]);
  });

  it('returns 403 for unauthenticated user', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const { status, data } = await parseResponse(
      await callPATCH('ride-1', 'reg-1', { approvalStatus: 'confirmed' })
    );

    expect(status).toBe(403);
    expect(data.error).toBe('Forbidden');
  });

  it('returns 403 for regular rider', async () => {
    mockGetCurrentUser.mockResolvedValue(mockRider);

    const { status, data } = await parseResponse(
      await callPATCH('ride-1', 'reg-1', { approvalStatus: 'confirmed' })
    );

    expect(status).toBe(403);
    expect(data.error).toBe('Forbidden');
  });

  it('returns 400 for invalid approval status', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);

    const { status, data } = await parseResponse(
      await callPATCH('ride-1', 'reg-1', { approvalStatus: 'invalid_status' })
    );

    expect(status).toBe(400);
    expect(data.error).toContain('Invalid status');
  });

  it('returns 404 when registration not found', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);
    mockFindFirst.mockResolvedValue(null);

    const { status, data } = await parseResponse(
      await callPATCH('ride-1', 'reg-999', { approvalStatus: 'confirmed' })
    );

    expect(status).toBe(404);
    expect(data.error).toBe('Registration not found');
  });

  it('confirms a registration and creates participation', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);
    mockFindFirst.mockResolvedValue({ id: 'reg-1', userId: 'user-10', rideId: 'ride-1' });
    mockUpdate.mockResolvedValue({ id: 'reg-1', approvalStatus: 'confirmed' });
    mockUserFindUnique.mockResolvedValue({ linkedRiderId: 'rider-10' });
    mockParticipationUpsert.mockResolvedValue({});
    mockSyncReturningNames(['Alice', 'Bob']);

    const { status, data } = await parseResponse(
      await callPATCH('ride-1', 'reg-1', { approvalStatus: 'confirmed' })
    );

    expect(status).toBe(200);
    expect(data.registration.approvalStatus).toBe('confirmed');
    expect(mockParticipationUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          riderProfileId_rideId: {
            riderProfileId: 'rider-10',
            rideId: 'ride-1',
          },
        },
        create: expect.objectContaining({ points: 5 }),
      })
    );
  });

  it('rejects a registration', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);
    mockFindFirst.mockResolvedValue({ id: 'reg-1', userId: 'user-10', rideId: 'ride-1' });
    mockUpdate.mockResolvedValue({ id: 'reg-1', approvalStatus: 'rejected' });
    mockUserFindUnique.mockResolvedValue({ linkedRiderId: 'rider-10' });
    mockSyncReturningNames([]);

    const { status, data } = await parseResponse(
      await callPATCH('ride-1', 'reg-1', { approvalStatus: 'rejected' })
    );

    expect(status).toBe(200);
    expect(data.registration.approvalStatus).toBe('rejected');
    // Neither upsert nor updateMany should be called for rejected status
    expect(mockParticipationUpsert).not.toHaveBeenCalled();
    expect(mockParticipationUpdateMany).not.toHaveBeenCalled();
  });

  it('marks registration as dropout and sets droppedOut flag', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);
    mockFindFirst.mockResolvedValue({ id: 'reg-1', userId: 'user-10', rideId: 'ride-1' });
    mockUpdate.mockResolvedValue({ id: 'reg-1', approvalStatus: 'dropout' });
    mockUserFindUnique.mockResolvedValue({ linkedRiderId: 'rider-10' });
    mockParticipationUpdateMany.mockResolvedValue({ count: 1 });
    mockSyncReturningNames(['Alice']);

    const { status, data } = await parseResponse(
      await callPATCH('ride-1', 'reg-1', { approvalStatus: 'dropout' })
    );

    expect(status).toBe(200);
    expect(data.registration.approvalStatus).toBe('dropout');
    expect(mockParticipationUpdateMany).toHaveBeenCalledWith({
      where: { riderProfileId: 'rider-10', rideId: 'ride-1' },
      data: { droppedOut: true },
    });
  });

  it('allows core_member to approve registrations', async () => {
    mockGetCurrentUser.mockResolvedValue(mockCoreMember);
    mockFindFirst.mockResolvedValue({ id: 'reg-1', userId: 'user-10', rideId: 'ride-1' });
    mockUpdate.mockResolvedValue({ id: 'reg-1', approvalStatus: 'confirmed' });
    mockUserFindUnique.mockResolvedValue({ linkedRiderId: 'rider-10' });
    mockParticipationUpsert.mockResolvedValue({});
    mockSyncReturningNames(['Alice']);

    const { status, data } = await parseResponse(
      await callPATCH('ride-1', 'reg-1', { approvalStatus: 'confirmed' })
    );

    expect(status).toBe(200);
    expect(data.registration.approvalStatus).toBe('confirmed');
  });

  it('syncs Ride.riders cache from confirmed registrations', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);
    mockFindFirst.mockResolvedValue({ id: 'reg-1', userId: 'user-10', rideId: 'ride-1' });
    mockUpdate.mockResolvedValue({ id: 'reg-1', approvalStatus: 'confirmed' });
    mockUserFindUnique.mockResolvedValue({ linkedRiderId: 'rider-10' });
    mockParticipationUpsert.mockResolvedValue({});
    mockSyncReturningNames(['Alice', 'Bob', 'Charlie']);

    await callPATCH('ride-1', 'reg-1', { approvalStatus: 'confirmed' });

    expect(mockFindMany).toHaveBeenCalledWith({
      where: { rideId: 'ride-1', approvalStatus: 'confirmed' },
      select: { riderName: true },
      orderBy: { registeredAt: 'asc' },
    });
    expect(mockRideUpdate).toHaveBeenCalledWith({
      where: { id: 'ride-1' },
      data: { riders: JSON.stringify(['Alice', 'Bob', 'Charlie']) },
    });
  });

  it('does not create participation when user has no linkedRiderId', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);
    mockFindFirst.mockResolvedValue({ id: 'reg-1', userId: 'user-10', rideId: 'ride-1' });
    mockUpdate.mockResolvedValue({ id: 'reg-1', approvalStatus: 'confirmed' });
    mockUserFindUnique.mockResolvedValue({ linkedRiderId: null });
    mockSyncReturningNames(['TestRider']);

    const { status } = await parseResponse(
      await callPATCH('ride-1', 'reg-1', { approvalStatus: 'confirmed' })
    );

    expect(status).toBe(200);
    expect(mockParticipationUpsert).not.toHaveBeenCalled();
    // But Ride.riders cache still synced
    expect(mockRideUpdate).toHaveBeenCalled();
  });
});
