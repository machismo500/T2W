import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNextRequest, parseResponse, mockSuperAdmin, mockCoreMember, mockRider } from '@/__tests__/helpers';

vi.mock('@/lib/db', () => {
  const mock: Record<string, unknown> = {
    liveRideSession: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    liveRideBreak: {
      updateMany: vi.fn(),
    },
    ride: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    riderProfile: {
      findFirst: vi.fn(),
    },
    liveRideLocation: {
      findMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
    $transaction: null,
  };
  mock.$transaction = vi.fn().mockImplementation(async (fn: (p: typeof mock) => unknown) => fn(mock));
  return { prisma: mock };
});

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}));

const mockGetRolePermissions = vi.fn();
vi.mock('@/lib/role-permissions', () => ({
  getRolePermissions: mockGetRolePermissions,
}));

import { GET, POST } from '@/app/api/rides/[id]/live/route';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

const mockGetCurrentUser = getCurrentUser as ReturnType<typeof vi.fn>;
const mockSessionFindUnique = prisma.liveRideSession.findUnique as ReturnType<typeof vi.fn>;
const mockSessionCreate = prisma.liveRideSession.create as ReturnType<typeof vi.fn>;
const mockSessionUpdate = prisma.liveRideSession.update as ReturnType<typeof vi.fn>;
const mockRideFindUnique = prisma.ride.findUnique as ReturnType<typeof vi.fn>;
const mockRideUpdate = prisma.ride.update as ReturnType<typeof vi.fn>;
const mockUserFindFirst = prisma.user.findFirst as ReturnType<typeof vi.fn>;
const mockUserFindMany = prisma.user.findMany as ReturnType<typeof vi.fn>;
const mockRiderProfileFindFirst = prisma.riderProfile.findFirst as ReturnType<typeof vi.fn>;
const mockLocationFindMany = prisma.liveRideLocation.findMany as ReturnType<typeof vi.fn>;
const mockQueryRaw = prisma.$queryRaw as ReturnType<typeof vi.fn>;

const makeGETParams = () => ({ params: Promise.resolve({ id: 'ride-1' }) });

function callPOST(rideId: string, body: Record<string, unknown>) {
  const req = createNextRequest(`http://localhost:3000/api/rides/${rideId}/live`, {
    method: 'POST',
    body,
  });
  return POST(req, { params: Promise.resolve({ id: rideId }) });
}

function callGET(rideId: string) {
  const req = createNextRequest(`http://localhost:3000/api/rides/${rideId}/live`);
  return GET(req, { params: Promise.resolve({ id: rideId }) });
}

describe('GET /api/rides/[id]/live', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 for unauthenticated user', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const res = await callGET('ride-1');
    const { status, data } = await parseResponse(res);

    expect(status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns null session when no live session exists', async () => {
    mockGetCurrentUser.mockResolvedValue(mockRider);
    mockSessionFindUnique.mockResolvedValue(null);

    const res = await callGET('ride-1');
    const { status, data } = await parseResponse(res);

    expect(status).toBe(200);
    expect(data.session).toBeNull();
    expect(data.riders).toEqual([]);
    expect(data.leadPath).toEqual([]);
  });

  it('returns session data with riders and lead path', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);

    const sessionData = {
      id: 'sess-1',
      rideId: 'ride-1',
      status: 'live',
      startedAt: new Date('2024-06-01T08:00:00Z'),
      endedAt: null,
      leadRiderId: 'user-10',
      sweepRiderId: 'user-11',
      plannedRoute: null,
      breaks: [
        {
          id: 'break-1',
          startedAt: new Date('2024-06-01T09:00:00Z'),
          endedAt: new Date('2024-06-01T09:15:00Z'),
          reason: 'Fuel stop',
        },
      ],
    };
    mockSessionFindUnique.mockResolvedValue(sessionData);

    // Latest locations via $queryRaw
    mockQueryRaw.mockResolvedValue([
      {
        id: 'loc-1',
        userId: 'user-10',
        lat: 12.9716,
        lng: 77.5946,
        speed: 60,
        heading: 90,
        isDeviated: false,
        recordedAt: new Date('2024-06-01T09:30:00Z'),
      },
      {
        id: 'loc-2',
        userId: 'user-11',
        lat: 12.9720,
        lng: 77.5950,
        speed: 55,
        heading: 85,
        isDeviated: false,
        recordedAt: new Date('2024-06-01T09:30:00Z'),
      },
    ]);

    // Users for name/avatar lookup
    mockUserFindMany.mockResolvedValue([
      { id: 'user-10', name: 'Lead Rider', avatar: 'lead.jpg' },
      { id: 'user-11', name: 'Sweep Rider', avatar: null },
    ]);

    // Lead path locations
    // Route now queries orderBy: recordedAt desc, take: 2000 and reverses on
    // the server — so the mock returns newest-first and the test asserts on
    // the chronological (reversed) output.
    mockLocationFindMany.mockResolvedValue([
      { lat: 12.9716, lng: 77.5946, recordedAt: new Date('2024-06-01T09:30:00Z') },
      { lat: 12.9700, lng: 77.5900, recordedAt: new Date('2024-06-01T08:00:00Z') },
    ]);

    const res = await callGET('ride-1');
    const { status, data } = await parseResponse(res);

    expect(status).toBe(200);

    // Session checks
    expect(data.session.id).toBe('sess-1');
    expect(data.session.status).toBe('live');
    expect(data.session.leadRiderId).toBe('user-10');
    expect(data.session.sweepRiderId).toBe('user-11');
    expect(data.session.breaks).toHaveLength(1);
    expect(data.session.breaks[0].reason).toBe('Fuel stop');

    // Riders checks
    expect(data.riders).toHaveLength(2);
    const leadRider = data.riders.find((r: any) => r.userId === 'user-10');
    expect(leadRider.userName).toBe('Lead Rider');
    expect(leadRider.isLead).toBe(true);
    expect(leadRider.isSweep).toBe(false);
    expect(leadRider.lat).toBe(12.9716);

    const sweepRider = data.riders.find((r: any) => r.userId === 'user-11');
    expect(sweepRider.userName).toBe('Sweep Rider');
    expect(sweepRider.isLead).toBe(false);
    expect(sweepRider.isSweep).toBe(true);

    // Lead path checks
    expect(data.leadPath).toHaveLength(2);
    expect(data.leadPath[0].lat).toBe(12.9700);
  });
});

describe('POST /api/rides/[id]/live', () => {
  const defaultRolePerms = {
    rider: { canRegisterForRides: true, canEditOwnProfile: true },
    t2w_rider: { canPostBlog: true, canPostRideTales: true, earlyRegistrationAccess: true },
    core_member: { canCreateRide: true, canEditRide: true, canManageRegistrations: true, canExportRegistrations: true, canControlLiveTracking: true, canApproveContent: true, canApproveUsers: true },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRolePermissions.mockResolvedValue(defaultRolePerms);
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (fn: (p: typeof prisma) => unknown) => fn(prisma)
    );
  });

  it('returns 403 for regular rider', async () => {
    mockGetCurrentUser.mockResolvedValue(mockRider);

    const res = await callPOST('ride-1', { action: 'start' });
    const { status, data } = await parseResponse(res);

    expect(status).toBe(403);
    expect(data.error).toBe('Forbidden');
  });

  it('returns 403 for unauthenticated user', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const res = await callPOST('ride-1', { action: 'start' });
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });

  it('returns 404 when ride not found', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);
    mockRideFindUnique.mockResolvedValue(null);

    const res = await callPOST('ride-999', { action: 'start' });
    const { status, data } = await parseResponse(res);

    expect(status).toBe(404);
    expect(data.error).toBe('Ride not found');
  });

  it('starts a new live session', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);
    mockRideFindUnique.mockResolvedValue({
      id: 'ride-1',
      leadRider: 'Lead Rider',
      sweepRider: 'Sweep Rider',
      route: '"Point A to Point B"',
      status: 'upcoming',
    });
    mockSessionFindUnique.mockResolvedValue(null); // No existing session

    // matchRiderToUser calls - lead rider exact match
    mockUserFindFirst.mockResolvedValueOnce({ id: 'user-10' });
    // matchRiderToUser calls - sweep rider exact match
    mockUserFindFirst.mockResolvedValueOnce({ id: 'user-11' });

    const createdSession = {
      id: 'sess-1',
      rideId: 'ride-1',
      status: 'live',
      startedAt: new Date(),
      startedBy: 'user-1',
      leadRiderId: 'user-10',
      sweepRiderId: 'user-11',
    };
    mockSessionCreate.mockResolvedValue(createdSession);
    mockRideUpdate.mockResolvedValue({});

    const res = await callPOST('ride-1', { action: 'start' });
    const { status, data } = await parseResponse(res);

    expect(status).toBe(200);
    expect(data.action).toBe('started');
    expect(data.session.id).toBe('sess-1');
    expect(data.session.status).toBe('live');

    // Verify ride status updated to ongoing
    expect(mockRideUpdate).toHaveBeenCalledWith({
      where: { id: 'ride-1' },
      data: { status: 'ongoing' },
    });
  });

  it('returns 400 when session already active', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);
    mockRideFindUnique.mockResolvedValue({
      id: 'ride-1',
      leadRider: 'Lead',
      sweepRider: 'Sweep',
      route: '""',
    });
    mockSessionFindUnique.mockResolvedValue({
      id: 'sess-1',
      rideId: 'ride-1',
      status: 'live',
    });

    const res = await callPOST('ride-1', { action: 'start' });
    const { status, data } = await parseResponse(res);

    expect(status).toBe(400);
    expect(data.error).toContain('already active');
  });

  it('pauses an active session', async () => {
    mockGetCurrentUser.mockResolvedValue(mockCoreMember);
    mockRideFindUnique.mockResolvedValue({ id: 'ride-1' });
    mockSessionFindUnique.mockResolvedValue({
      id: 'sess-1',
      rideId: 'ride-1',
      status: 'live',
    });

    const updatedSession = { id: 'sess-1', rideId: 'ride-1', status: 'paused' };
    mockSessionUpdate.mockResolvedValue(updatedSession);

    const res = await callPOST('ride-1', { action: 'pause' });
    const { status, data } = await parseResponse(res);

    expect(status).toBe(200);
    expect(data.action).toBe('paused');
    expect(data.session.status).toBe('paused');
    expect(mockSessionUpdate).toHaveBeenCalledWith({
      where: { rideId: 'ride-1' },
      data: { status: 'paused' },
    });
  });

  it('resumes a paused session', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);
    mockRideFindUnique.mockResolvedValue({ id: 'ride-1' });
    mockSessionFindUnique.mockResolvedValue({
      id: 'sess-1',
      rideId: 'ride-1',
      status: 'paused',
    });

    const updatedSession = { id: 'sess-1', rideId: 'ride-1', status: 'live' };
    mockSessionUpdate.mockResolvedValue(updatedSession);

    const res = await callPOST('ride-1', { action: 'resume' });
    const { status, data } = await parseResponse(res);

    expect(status).toBe(200);
    expect(data.action).toBe('resumed');
    expect(data.session.status).toBe('live');
    expect(mockSessionUpdate).toHaveBeenCalledWith({
      where: { rideId: 'ride-1' },
      data: { status: 'live' },
    });
  });

  it('ends a session and marks ride as completed', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);
    mockRideFindUnique.mockResolvedValue({ id: 'ride-1' });
    mockSessionFindUnique.mockResolvedValue({
      id: 'sess-1',
      rideId: 'ride-1',
      status: 'live',
    });

    const updatedSession = {
      id: 'sess-1',
      rideId: 'ride-1',
      status: 'ended',
      endedAt: new Date(),
    };
    mockSessionUpdate.mockResolvedValue(updatedSession);
    mockRideUpdate.mockResolvedValue({});
    // Route now auto-closes any open breaks in the same transaction
    vi.mocked(prisma.liveRideBreak.updateMany).mockResolvedValue({ count: 0 } as any);

    const res = await callPOST('ride-1', { action: 'end' });
    const { status, data } = await parseResponse(res);

    expect(status).toBe(200);
    expect(data.action).toBe('ended');
    expect(data.session.status).toBe('ended');

    // Verify ride status updated to completed
    expect(mockRideUpdate).toHaveBeenCalledWith({
      where: { id: 'ride-1' },
      data: { status: 'completed' },
    });
  });

  it('returns 400 for invalid action', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);
    mockRideFindUnique.mockResolvedValue({ id: 'ride-1' });

    const res = await callPOST('ride-1', { action: 'invalid' });
    const { status, data } = await parseResponse(res);

    expect(status).toBe(400);
    expect(data.error).toContain('Invalid action');
  });

  it('returns 404 when no session exists for pause', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);
    mockRideFindUnique.mockResolvedValue({ id: 'ride-1' });
    mockSessionFindUnique.mockResolvedValue(null);

    const res = await callPOST('ride-1', { action: 'pause' });
    const { status, data } = await parseResponse(res);

    expect(status).toBe(404);
    expect(data.error).toContain('No active session');
  });

  it('returns 404 when no session exists for resume', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);
    mockRideFindUnique.mockResolvedValue({ id: 'ride-1' });
    mockSessionFindUnique.mockResolvedValue(null);

    const res = await callPOST('ride-1', { action: 'resume' });
    const { status, data } = await parseResponse(res);

    expect(status).toBe(404);
    expect(data.error).toContain('No active session');
  });

  it('returns 404 when no session exists for end', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);
    mockRideFindUnique.mockResolvedValue({ id: 'ride-1' });
    mockSessionFindUnique.mockResolvedValue(null);

    const res = await callPOST('ride-1', { action: 'end' });
    const { status, data } = await parseResponse(res);

    expect(status).toBe(404);
    expect(data.error).toContain('No active session');
  });

  it('allows core_member to start a session', async () => {
    mockGetCurrentUser.mockResolvedValue(mockCoreMember);
    mockRideFindUnique.mockResolvedValue({
      id: 'ride-1',
      leadRider: '',
      sweepRider: '',
      route: '""',
    });
    mockSessionFindUnique.mockResolvedValue(null);

    const createdSession = {
      id: 'sess-1',
      rideId: 'ride-1',
      status: 'live',
      startedAt: new Date(),
      startedBy: 'user-2',
      leadRiderId: null,
      sweepRiderId: null,
    };
    mockSessionCreate.mockResolvedValue(createdSession);
    mockRideUpdate.mockResolvedValue({});

    const res = await callPOST('ride-1', { action: 'start' });
    const { status, data } = await parseResponse(res);

    expect(status).toBe(200);
    expect(data.action).toBe('started');
  });

  it('restarts an ended session', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);
    mockRideFindUnique.mockResolvedValue({
      id: 'ride-1',
      leadRider: 'Lead',
      sweepRider: 'Sweep',
      route: '""',
    });
    // Existing session with ended status
    mockSessionFindUnique.mockResolvedValue({
      id: 'sess-1',
      rideId: 'ride-1',
      status: 'ended',
    });

    // matchRiderToUser - no matches
    mockUserFindFirst.mockResolvedValue(null);
    mockRiderProfileFindFirst.mockResolvedValue(null);

    const updatedSession = {
      id: 'sess-1',
      rideId: 'ride-1',
      status: 'live',
      startedAt: new Date(),
      endedAt: null,
    };
    mockSessionUpdate.mockResolvedValue(updatedSession);

    const res = await callPOST('ride-1', { action: 'start' });
    const { status, data } = await parseResponse(res);

    expect(status).toBe(200);
    expect(data.action).toBe('restarted');
    expect(data.session.status).toBe('live');
  });
});

describe('POST /api/rides/[id]/live — permission gating', () => {
  const defaultRolePerms = {
    rider: { canRegisterForRides: true, canEditOwnProfile: true },
    t2w_rider: { canPostBlog: true, canPostRideTales: true, earlyRegistrationAccess: true },
    core_member: { canCreateRide: true, canEditRide: true, canManageRegistrations: true, canExportRegistrations: true, canControlLiveTracking: true, canApproveContent: true, canApproveUsers: true },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRolePermissions.mockResolvedValue(defaultRolePerms);
  });

  it('blocks core_member when canControlLiveTracking is disabled', async () => {
    mockGetCurrentUser.mockResolvedValue(mockCoreMember);
    mockGetRolePermissions.mockResolvedValue({
      ...defaultRolePerms,
      core_member: { ...defaultRolePerms.core_member, canControlLiveTracking: false },
    });

    const res = await callPOST('ride-1', { action: 'start' });
    const { status, data } = await parseResponse(res);

    expect(status).toBe(403);
    expect(data.error).toContain('permission');
  });

  it('allows core_member to control live tracking when permission is enabled', async () => {
    mockGetCurrentUser.mockResolvedValue(mockCoreMember);
    mockRideFindUnique.mockResolvedValue({ id: 'ride-1', status: 'ongoing', leadRider: null, sweepRider: null });
    mockSessionFindUnique.mockResolvedValue(null);
    mockUserFindFirst.mockResolvedValue(null);
    mockRiderProfileFindFirst.mockResolvedValue(null);
    mockSessionCreate.mockResolvedValue({
      id: 'sess-1', rideId: 'ride-1', status: 'live', startedAt: new Date(), endedAt: null,
    });
    mockRideUpdate.mockResolvedValue({});

    const res = await callPOST('ride-1', { action: 'start' });
    const { status } = await parseResponse(res);

    expect(status).toBe(200);
  });

  it('superadmin can always control live tracking regardless of permission toggle', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);
    mockGetRolePermissions.mockResolvedValue({
      ...defaultRolePerms,
      core_member: { ...defaultRolePerms.core_member, canControlLiveTracking: false },
    });
    mockRideFindUnique.mockResolvedValue({ id: 'ride-1', status: 'ongoing', leadRider: null, sweepRider: null });
    mockSessionFindUnique.mockResolvedValue(null);
    mockUserFindFirst.mockResolvedValue(null);
    mockRiderProfileFindFirst.mockResolvedValue(null);
    mockSessionCreate.mockResolvedValue({
      id: 'sess-1', rideId: 'ride-1', status: 'live', startedAt: new Date(), endedAt: null,
    });
    mockRideUpdate.mockResolvedValue({});

    const res = await callPOST('ride-1', { action: 'start' });
    const { status } = await parseResponse(res);

    expect(status).toBe(200);
  });
});
