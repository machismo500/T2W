import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNextRequest, parseResponse, mockSuperAdmin, mockCoreMember, mockRider } from '@/__tests__/helpers';

vi.mock('@/lib/db', () => ({
  prisma: {
    riderProfile: {
      findFirst: vi.fn(),
    },
    rideRegistration: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    rideParticipation: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    ride: {
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}));

import { POST, DELETE } from '@/app/api/rides/[id]/registrations/admin-manage/route';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

const mockGetCurrentUser = getCurrentUser as ReturnType<typeof vi.fn>;
const mockRiderProfileFindFirst = prisma.riderProfile.findFirst as ReturnType<typeof vi.fn>;
const mockRegFindUnique = prisma.rideRegistration.findUnique as ReturnType<typeof vi.fn>;
const mockRegFindFirst = prisma.rideRegistration.findFirst as ReturnType<typeof vi.fn>;
const mockRegFindMany = prisma.rideRegistration.findMany as ReturnType<typeof vi.fn>;
const mockRegCreate = prisma.rideRegistration.create as ReturnType<typeof vi.fn>;
const mockRegUpdate = prisma.rideRegistration.update as ReturnType<typeof vi.fn>;
const mockRegDelete = prisma.rideRegistration.delete as ReturnType<typeof vi.fn>;
const mockParticipationUpsert = prisma.rideParticipation.upsert as ReturnType<typeof vi.fn>;
const mockParticipationDeleteMany = prisma.rideParticipation.deleteMany as ReturnType<typeof vi.fn>;
const mockRideUpdate = prisma.ride.update as ReturnType<typeof vi.fn>;

function callPOST(rideId: string, body: Record<string, unknown>) {
  const req = createNextRequest(`http://localhost:3000/api/rides/${rideId}/registrations/admin-manage`, {
    method: 'POST',
    body,
  });
  return POST(req, { params: Promise.resolve({ id: rideId }) });
}

function callDELETE(rideId: string, body: Record<string, unknown>) {
  const req = createNextRequest(`http://localhost:3000/api/rides/${rideId}/registrations/admin-manage`, {
    method: 'DELETE',
    body,
  });
  return DELETE(req, { params: Promise.resolve({ id: rideId }) });
}

/** Helper: set up mocks so syncRideRidersFromRegistrations works correctly */
function mockSyncReturningNames(names: string[]) {
  mockRegFindMany.mockResolvedValue(names.map((n) => ({ riderName: n })));
  mockRideUpdate.mockResolvedValue({});
}

describe('POST /api/rides/[id]/registrations/admin-manage (add rider)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSyncReturningNames([]);
  });

  it('returns 403 for non-admin user', async () => {
    mockGetCurrentUser.mockResolvedValue(mockRider);

    const { status, data } = await parseResponse(
      await callPOST('ride-1', { riderName: 'Alice' })
    );

    expect(status).toBe(403);
    expect(data.error).toBe('Forbidden');
  });

  it('returns 403 for unauthenticated request', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const { status } = await parseResponse(
      await callPOST('ride-1', { riderName: 'Alice' })
    );

    expect(status).toBe(403);
  });

  it('returns 400 when riderName is missing', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);

    const { status, data } = await parseResponse(
      await callPOST('ride-1', {})
    );

    expect(status).toBe(400);
    expect(data.error).toBe('riderName is required');
  });

  it('returns 400 when rider has no linked user account', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);
    mockRiderProfileFindFirst.mockResolvedValue({
      id: 'rp-1',
      name: 'Alice',
      linkedUsers: [], // No linked user account
    });

    const { status, data } = await parseResponse(
      await callPOST('ride-1', { riderName: 'Alice' })
    );

    expect(status).toBe(400);
    expect(data.error).toContain('No user account found');
  });

  it('returns 400 when rider profile not found', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);
    mockRiderProfileFindFirst.mockResolvedValue(null);

    const { status, data } = await parseResponse(
      await callPOST('ride-1', { riderName: 'NonExistent' })
    );

    expect(status).toBe(400);
    expect(data.error).toContain('No user account found');
  });

  it('creates a confirmed registration for a new rider', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);
    mockRiderProfileFindFirst.mockResolvedValue({
      id: 'rp-1',
      name: 'Alice',
      linkedUsers: [{ id: 'user-10', email: 'alice@test.com', phone: '1234567890' }],
    });
    mockRegFindUnique.mockResolvedValue(null); // No existing registration
    mockRegCreate.mockResolvedValue({ id: 'reg-new' });
    mockParticipationUpsert.mockResolvedValue({});
    mockSyncReturningNames(['Alice']);

    const { status, data } = await parseResponse(
      await callPOST('ride-1', { riderName: 'Alice' })
    );

    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.riderName).toBe('Alice');

    // Verify registration was created with confirmed status
    expect(mockRegCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-10',
        rideId: 'ride-1',
        riderName: 'Alice',
        email: 'alice@test.com',
        phone: '1234567890',
        approvalStatus: 'confirmed',
      }),
    });

    // Verify participation was created
    expect(mockParticipationUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { riderProfileId_rideId: { riderProfileId: 'rp-1', rideId: 'ride-1' } },
        create: expect.objectContaining({ points: 5 }),
      })
    );
  });

  it('confirms an existing pending registration instead of creating a new one', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);
    mockRiderProfileFindFirst.mockResolvedValue({
      id: 'rp-1',
      name: 'Alice',
      linkedUsers: [{ id: 'user-10', email: 'alice@test.com', phone: '1234567890' }],
    });
    mockRegFindUnique.mockResolvedValue({
      id: 'reg-existing',
      approvalStatus: 'pending', // Was pending
    });
    mockRegUpdate.mockResolvedValue({ id: 'reg-existing', approvalStatus: 'confirmed' });
    mockParticipationUpsert.mockResolvedValue({});
    mockSyncReturningNames(['Alice']);

    const { status, data } = await parseResponse(
      await callPOST('ride-1', { riderName: 'Alice' })
    );

    expect(status).toBe(200);
    expect(data.success).toBe(true);

    // Should update existing registration, not create new
    expect(mockRegCreate).not.toHaveBeenCalled();
    expect(mockRegUpdate).toHaveBeenCalledWith({
      where: { id: 'reg-existing' },
      data: { approvalStatus: 'confirmed' },
    });
  });

  it('does nothing for already-confirmed registration', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);
    mockRiderProfileFindFirst.mockResolvedValue({
      id: 'rp-1',
      name: 'Alice',
      linkedUsers: [{ id: 'user-10', email: 'alice@test.com', phone: '1234567890' }],
    });
    mockRegFindUnique.mockResolvedValue({
      id: 'reg-existing',
      approvalStatus: 'confirmed', // Already confirmed
    });
    mockParticipationUpsert.mockResolvedValue({});
    mockSyncReturningNames(['Alice']);

    const { status } = await parseResponse(
      await callPOST('ride-1', { riderName: 'Alice' })
    );

    expect(status).toBe(200);
    // Should not create or update registration
    expect(mockRegCreate).not.toHaveBeenCalled();
    expect(mockRegUpdate).not.toHaveBeenCalled();
  });

  it('syncs Ride.riders cache after adding', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);
    mockRiderProfileFindFirst.mockResolvedValue({
      id: 'rp-1',
      name: 'Alice',
      linkedUsers: [{ id: 'user-10', email: 'alice@test.com', phone: '1234567890' }],
    });
    mockRegFindUnique.mockResolvedValue(null);
    mockRegCreate.mockResolvedValue({ id: 'reg-new' });
    mockParticipationUpsert.mockResolvedValue({});
    mockSyncReturningNames(['Alice', 'Bob', 'Charlie']);

    await callPOST('ride-1', { riderName: 'Alice' });

    // Verify sync was called with confirmed registrations
    expect(mockRegFindMany).toHaveBeenCalledWith({
      where: { rideId: 'ride-1', approvalStatus: 'confirmed' },
      select: { riderName: true },
      orderBy: { registeredAt: 'asc' },
    });
    expect(mockRideUpdate).toHaveBeenCalledWith({
      where: { id: 'ride-1' },
      data: { riders: JSON.stringify(['Alice', 'Bob', 'Charlie']) },
    });
  });

  it('allows core_member to add riders', async () => {
    mockGetCurrentUser.mockResolvedValue(mockCoreMember);
    mockRiderProfileFindFirst.mockResolvedValue({
      id: 'rp-1',
      name: 'Alice',
      linkedUsers: [{ id: 'user-10', email: 'alice@test.com', phone: '1234567890' }],
    });
    mockRegFindUnique.mockResolvedValue(null);
    mockRegCreate.mockResolvedValue({ id: 'reg-new' });
    mockParticipationUpsert.mockResolvedValue({});
    mockSyncReturningNames(['Alice']);

    const { status } = await parseResponse(
      await callPOST('ride-1', { riderName: 'Alice' })
    );

    expect(status).toBe(200);
  });

  it('trims whitespace from rider name', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);
    mockRiderProfileFindFirst.mockResolvedValue({
      id: 'rp-1',
      name: 'Alice',
      linkedUsers: [{ id: 'user-10', email: 'alice@test.com', phone: '1234567890' }],
    });
    mockRegFindUnique.mockResolvedValue(null);
    mockRegCreate.mockResolvedValue({ id: 'reg-new' });
    mockParticipationUpsert.mockResolvedValue({});
    mockSyncReturningNames(['Alice']);

    const { status, data } = await parseResponse(
      await callPOST('ride-1', { riderName: '  Alice  ' })
    );

    expect(status).toBe(200);
    expect(data.riderName).toBe('Alice');
  });

  it('re-confirms a previously rejected registration', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);
    mockRiderProfileFindFirst.mockResolvedValue({
      id: 'rp-1',
      name: 'Alice',
      linkedUsers: [{ id: 'user-10', email: 'alice@test.com', phone: '1234567890' }],
    });
    mockRegFindUnique.mockResolvedValue({
      id: 'reg-existing',
      approvalStatus: 'rejected', // Was rejected
    });
    mockRegUpdate.mockResolvedValue({ id: 'reg-existing', approvalStatus: 'confirmed' });
    mockParticipationUpsert.mockResolvedValue({});
    mockSyncReturningNames(['Alice']);

    const { status } = await parseResponse(
      await callPOST('ride-1', { riderName: 'Alice' })
    );

    expect(status).toBe(200);
    expect(mockRegUpdate).toHaveBeenCalledWith({
      where: { id: 'reg-existing' },
      data: { approvalStatus: 'confirmed' },
    });
  });
});

describe('DELETE /api/rides/[id]/registrations/admin-manage (remove rider)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSyncReturningNames([]);
  });

  it('returns 403 for non-admin user', async () => {
    mockGetCurrentUser.mockResolvedValue(mockRider);

    const { status, data } = await parseResponse(
      await callDELETE('ride-1', { riderName: 'Alice' })
    );

    expect(status).toBe(403);
    expect(data.error).toBe('Forbidden');
  });

  it('returns 400 when riderName is missing', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);

    const { status, data } = await parseResponse(
      await callDELETE('ride-1', {})
    );

    expect(status).toBe(400);
    expect(data.error).toBe('riderName is required');
  });

  it('deletes registration and participation for a rider', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);
    mockRegFindFirst.mockResolvedValue({ id: 'reg-1', riderName: 'Alice' });
    mockRegDelete.mockResolvedValue({});
    mockRiderProfileFindFirst.mockResolvedValue({ id: 'rp-1', name: 'Alice' });
    mockParticipationDeleteMany.mockResolvedValue({ count: 1 });
    mockSyncReturningNames(['Bob', 'Charlie']); // Alice removed

    const { status, data } = await parseResponse(
      await callDELETE('ride-1', { riderName: 'Alice' })
    );

    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.riderName).toBe('Alice');

    // Verify registration deleted
    expect(mockRegDelete).toHaveBeenCalledWith({ where: { id: 'reg-1' } });

    // Verify participation removed
    expect(mockParticipationDeleteMany).toHaveBeenCalledWith({
      where: { riderProfileId: 'rp-1', rideId: 'ride-1' },
    });
  });

  it('syncs Ride.riders cache after removal', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);
    mockRegFindFirst.mockResolvedValue({ id: 'reg-1', riderName: 'Alice' });
    mockRegDelete.mockResolvedValue({});
    mockRiderProfileFindFirst.mockResolvedValue({ id: 'rp-1', name: 'Alice' });
    mockParticipationDeleteMany.mockResolvedValue({ count: 1 });
    mockSyncReturningNames(['Bob']); // Only Bob remains

    await callDELETE('ride-1', { riderName: 'Alice' });

    expect(mockRideUpdate).toHaveBeenCalledWith({
      where: { id: 'ride-1' },
      data: { riders: JSON.stringify(['Bob']) },
    });
  });

  it('handles rider with no existing registration gracefully', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);
    mockRegFindFirst.mockResolvedValue(null); // No registration found
    mockRiderProfileFindFirst.mockResolvedValue({ id: 'rp-1', name: 'Alice' });
    mockParticipationDeleteMany.mockResolvedValue({ count: 0 });
    mockSyncReturningNames([]);

    const { status, data } = await parseResponse(
      await callDELETE('ride-1', { riderName: 'Alice' })
    );

    expect(status).toBe(200);
    expect(data.success).toBe(true);
    // Should not attempt to delete non-existent registration
    expect(mockRegDelete).not.toHaveBeenCalled();
  });

  it('handles rider with no profile gracefully', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);
    mockRegFindFirst.mockResolvedValue({ id: 'reg-1', riderName: 'Alice' });
    mockRegDelete.mockResolvedValue({});
    mockRiderProfileFindFirst.mockResolvedValue(null); // No rider profile
    mockSyncReturningNames([]);

    const { status } = await parseResponse(
      await callDELETE('ride-1', { riderName: 'Alice' })
    );

    expect(status).toBe(200);
    // Registration deleted but participation not touched (no profile)
    expect(mockRegDelete).toHaveBeenCalled();
    expect(mockParticipationDeleteMany).not.toHaveBeenCalled();
  });

  it('allows core_member to remove riders', async () => {
    mockGetCurrentUser.mockResolvedValue(mockCoreMember);
    mockRegFindFirst.mockResolvedValue({ id: 'reg-1', riderName: 'Alice' });
    mockRegDelete.mockResolvedValue({});
    mockRiderProfileFindFirst.mockResolvedValue(null);
    mockSyncReturningNames([]);

    const { status } = await parseResponse(
      await callDELETE('ride-1', { riderName: 'Alice' })
    );

    expect(status).toBe(200);
  });
});

describe('Single source of truth: rider count consistency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Ride.riders cache always matches confirmed registration count after add', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);
    mockRiderProfileFindFirst.mockResolvedValue({
      id: 'rp-1',
      name: 'NewRider',
      linkedUsers: [{ id: 'user-10', email: 'new@test.com', phone: '111' }],
    });
    mockRegFindUnique.mockResolvedValue(null);
    mockRegCreate.mockResolvedValue({ id: 'reg-new' });
    mockParticipationUpsert.mockResolvedValue({});

    // After adding, 3 confirmed riders exist
    const confirmedNames = ['Alice', 'Bob', 'NewRider'];
    mockSyncReturningNames(confirmedNames);

    await callPOST('ride-1', { riderName: 'NewRider' });

    // The Ride.riders JSON must contain exactly the confirmed registration names
    expect(mockRideUpdate).toHaveBeenCalledWith({
      where: { id: 'ride-1' },
      data: { riders: JSON.stringify(confirmedNames) },
    });

    // The count in the cache (3) matches the confirmed registration count (3)
    const cachedRiders = JSON.parse(
      (mockRideUpdate.mock.calls[0][0] as { data: { riders: string } }).data.riders
    );
    expect(cachedRiders.length).toBe(confirmedNames.length);
  });

  it('Ride.riders cache always matches confirmed registration count after remove', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);
    mockRegFindFirst.mockResolvedValue({ id: 'reg-1', riderName: 'Alice' });
    mockRegDelete.mockResolvedValue({});
    mockRiderProfileFindFirst.mockResolvedValue({ id: 'rp-1', name: 'Alice' });
    mockParticipationDeleteMany.mockResolvedValue({ count: 1 });

    // After removing Alice, only Bob remains confirmed
    const confirmedNames = ['Bob'];
    mockSyncReturningNames(confirmedNames);

    await callDELETE('ride-1', { riderName: 'Alice' });

    const cachedRiders = JSON.parse(
      (mockRideUpdate.mock.calls[0][0] as { data: { riders: string } }).data.riders
    );
    expect(cachedRiders.length).toBe(confirmedNames.length);
    expect(cachedRiders).toEqual(confirmedNames);
  });
});
