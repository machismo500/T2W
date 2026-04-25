import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNextRequest, parseResponse, mockSuperAdmin, mockCoreMember } from '@/__tests__/helpers';

// Mock DB — includes scheduledEmail so staggered-schedule tests can assert createMany
vi.mock('@/lib/db', () => ({
  prisma: {
    ride: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    scheduledEmail: {
      createMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/lib/role-permissions', () => ({
  getRolePermissions: vi.fn().mockResolvedValue({
    core_member: { canCreateRide: true },
  }),
}));

vi.mock('@/lib/email', () => ({
  sendRideAnnouncementEmails: vi.fn().mockResolvedValue(undefined),
  sendTierAnnouncementEmails: vi.fn().mockResolvedValue(undefined),
  sendRideReminderEmails: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from '@/app/api/rides/route';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { sendRideAnnouncementEmails } from '@/lib/email';

const mockGetCurrentUser = getCurrentUser as ReturnType<typeof vi.fn>;
const mockCreateMany = prisma.scheduledEmail.createMany as ReturnType<typeof vi.fn>;
const mockRideCreate = prisma.ride.create as ReturnType<typeof vi.fn>;
const mockCount = prisma.ride.count as ReturnType<typeof vi.fn>;
const mockSendAnnouncement = sendRideAnnouncementEmails as ReturnType<typeof vi.fn>;

const BASE_RIDE = {
  id: 'ride-1',
  rideNumber: '#001',
  title: 'Jungle Ride',
  startLocation: 'Bangalore',
  endLocation: 'Coorg',
  startDate: new Date('2026-05-10'),
  endDate: new Date('2026-05-12'),
  distanceKm: 350,
  description: 'Great ride',
  posterUrl: null,
  fee: 500,
  leadRider: 'Admin',
  regOpenCore: null,
  regOpenT2w: null,
  regOpenRider: null,
};

describe('POST /api/rides — email scheduling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);
    mockCount.mockResolvedValue(0);
    mockRideCreate.mockResolvedValue({ ...BASE_RIDE });
    mockCreateMany.mockResolvedValue({ count: 0 });
  });

  it('sends immediate announcement when no staggered schedule is set', async () => {
    const req = createNextRequest('http://localhost:3000/api/rides', {
      method: 'POST',
      body: {
        title: 'Jungle Ride',
        startDate: '2026-05-10',
        endDate: '2026-05-12',
        startLocation: 'Bangalore',
        endLocation: 'Coorg',
        notifyMode: 'all',
      },
    });
    const { status } = await parseResponse(await POST(req));

    expect(status).toBe(200);
    expect(mockSendAnnouncement).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'ride-1' }),
      'all'
    );
    expect(mockCreateMany).not.toHaveBeenCalled();
  });

  it('does not send any email when notifyMode is none', async () => {
    const req = createNextRequest('http://localhost:3000/api/rides', {
      method: 'POST',
      body: {
        title: 'Jungle Ride',
        startDate: '2026-05-10',
        endDate: '2026-05-12',
        startLocation: 'Bangalore',
        endLocation: 'Coorg',
        notifyMode: 'none',
      },
    });
    await parseResponse(await POST(req));

    expect(mockSendAnnouncement).not.toHaveBeenCalled();
    expect(mockCreateMany).not.toHaveBeenCalled();
  });

  it('creates scheduled email jobs per tier when regOpenCore + regOpenT2w are set', async () => {
    const regOpenCore = new Date('2026-05-10T08:00:00Z');
    const regOpenT2w = new Date('2026-05-10T10:00:00Z');
    mockRideCreate.mockResolvedValue({ ...BASE_RIDE, regOpenCore, regOpenT2w, regOpenRider: null });

    const req = createNextRequest('http://localhost:3000/api/rides', {
      method: 'POST',
      body: {
        title: 'Jungle Ride',
        startDate: '2026-05-10',
        endDate: '2026-05-12',
        startLocation: 'Bangalore',
        endLocation: 'Coorg',
        regOpenCore: regOpenCore.toISOString(),
        regOpenT2w: regOpenT2w.toISOString(),
        notifyMode: 'all',
      },
    });
    await parseResponse(await POST(req));

    expect(mockSendAnnouncement).not.toHaveBeenCalled();
    expect(mockCreateMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ tier: 'core', notifyMode: 'all', scheduledAt: regOpenCore }),
        expect.objectContaining({ tier: 't2w', notifyMode: 'all', scheduledAt: regOpenT2w }),
        // rider_guest falls back to t2w time
        expect.objectContaining({ tier: 'rider_guest', notifyMode: 'all', scheduledAt: regOpenT2w }),
      ]),
      skipDuplicates: true,
    });
  });

  it('creates all three tier jobs when regOpenRider is also set', async () => {
    const regOpenCore = new Date('2026-05-10T08:00:00Z');
    const regOpenT2w = new Date('2026-05-10T10:00:00Z');
    const regOpenRider = new Date('2026-05-10T11:00:00Z');
    mockRideCreate.mockResolvedValue({ ...BASE_RIDE, regOpenCore, regOpenT2w, regOpenRider });

    const req = createNextRequest('http://localhost:3000/api/rides', {
      method: 'POST',
      body: {
        title: 'Jungle Ride',
        startDate: '2026-05-10',
        endDate: '2026-05-12',
        startLocation: 'Bangalore',
        endLocation: 'Coorg',
        regOpenCore: regOpenCore.toISOString(),
        regOpenT2w: regOpenT2w.toISOString(),
        regOpenRider: regOpenRider.toISOString(),
        notifyMode: 'selected',
      },
    });
    await parseResponse(await POST(req));

    const callArg = mockCreateMany.mock.calls[0][0];
    expect(callArg.data).toHaveLength(3);
    expect(callArg.data.find((j: { tier: string }) => j.tier === 'core').scheduledAt).toEqual(regOpenCore);
    expect(callArg.data.find((j: { tier: string }) => j.tier === 't2w').scheduledAt).toEqual(regOpenT2w);
    expect(callArg.data.find((j: { tier: string }) => j.tier === 'rider_guest').scheduledAt).toEqual(regOpenRider);
    expect(callArg.data.every((j: { notifyMode: string }) => j.notifyMode === 'selected')).toBe(true);
  });

  it('rider_guest uses t2w time when regOpenRider is null (fallback rule)', async () => {
    const regOpenT2w = new Date('2026-05-10T10:00:00Z');
    mockRideCreate.mockResolvedValue({ ...BASE_RIDE, regOpenCore: null, regOpenT2w, regOpenRider: null });

    const req = createNextRequest('http://localhost:3000/api/rides', {
      method: 'POST',
      body: {
        title: 'Jungle Ride',
        startDate: '2026-05-10',
        endDate: '2026-05-12',
        startLocation: 'Bangalore',
        endLocation: 'Coorg',
        regOpenT2w: regOpenT2w.toISOString(),
        notifyMode: 'all',
      },
    });
    await parseResponse(await POST(req));

    const jobs: { tier: string; scheduledAt: Date }[] = mockCreateMany.mock.calls[0][0].data;
    const riderJob = jobs.find(j => j.tier === 'rider_guest');
    expect(riderJob).toBeDefined();
    expect(riderJob!.scheduledAt).toEqual(regOpenT2w);
    // No core job because regOpenCore is null
    expect(jobs.find(j => j.tier === 'core')).toBeUndefined();
  });

  it('skips createMany when staggered times are all null', async () => {
    // regOpenCore/T2w/Rider all null means no staggered — should use immediate send
    const req = createNextRequest('http://localhost:3000/api/rides', {
      method: 'POST',
      body: {
        title: 'Jungle Ride',
        startDate: '2026-05-10',
        endDate: '2026-05-12',
        startLocation: 'Bangalore',
        endLocation: 'Coorg',
        notifyMode: 'selected',
      },
    });
    await parseResponse(await POST(req));

    expect(mockCreateMany).not.toHaveBeenCalled();
    expect(mockSendAnnouncement).toHaveBeenCalledWith(
      expect.any(Object), 'selected'
    );
  });

  it('returns 200 and correct ride data regardless of email mode', async () => {
    const regOpenT2w = new Date('2026-05-10T10:00:00Z');
    mockRideCreate.mockResolvedValue({ ...BASE_RIDE, regOpenT2w });

    const req = createNextRequest('http://localhost:3000/api/rides', {
      method: 'POST',
      body: {
        title: 'Jungle Ride',
        startDate: '2026-05-10',
        endDate: '2026-05-12',
        startLocation: 'Bangalore',
        endLocation: 'Coorg',
        regOpenT2w: regOpenT2w.toISOString(),
        notifyMode: 'all',
      },
    });
    const { status, data } = await parseResponse(await POST(req));

    expect(status).toBe(200);
    expect(data.ride.id).toBe('ride-1');
  });

  it('only core_member with canCreateRide can use staggered scheduling', async () => {
    mockGetCurrentUser.mockResolvedValue(mockCoreMember);
    const regOpenT2w = new Date('2026-05-10T10:00:00Z');
    mockRideCreate.mockResolvedValue({ ...BASE_RIDE, regOpenT2w });

    const req = createNextRequest('http://localhost:3000/api/rides', {
      method: 'POST',
      body: {
        title: 'Jungle Ride',
        startDate: '2026-05-10',
        endDate: '2026-05-12',
        startLocation: 'Bangalore',
        endLocation: 'Coorg',
        regOpenT2w: regOpenT2w.toISOString(),
        notifyMode: 'all',
      },
    });
    const { status } = await parseResponse(await POST(req));

    expect(status).toBe(200);
    expect(mockCreateMany).toHaveBeenCalled();
  });
});
