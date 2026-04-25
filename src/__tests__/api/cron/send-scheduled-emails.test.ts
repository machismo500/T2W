import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createNextRequest, parseResponse } from '@/__tests__/helpers';

vi.mock('@/lib/db', () => ({
  prisma: {
    scheduledEmail: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/email', () => ({
  sendTierAnnouncementEmails: vi.fn().mockResolvedValue(undefined),
}));

import { GET } from '@/app/api/cron/send-scheduled-emails/route';
import { prisma } from '@/lib/db';
import { sendTierAnnouncementEmails } from '@/lib/email';

const mockFindMany = prisma.scheduledEmail.findMany as ReturnType<typeof vi.fn>;
const mockUpdateMany = prisma.scheduledEmail.updateMany as ReturnType<typeof vi.fn>;
const mockSendTier = sendTierAnnouncementEmails as ReturnType<typeof vi.fn>;

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
};

const makeJob = (overrides: Partial<{ id: string; tier: string; notifyMode: string; scheduledAt: Date }> = {}) => ({
  id: 'job-1',
  rideId: 'ride-1',
  tier: 'core',
  notifyMode: 'all',
  scheduledAt: new Date('2026-04-25T08:00:00Z'),
  sentAt: null,
  ride: { ...BASE_RIDE },
  ...overrides,
});

const makeRequest = (authHeader?: string) =>
  createNextRequest('http://localhost:3000/api/cron/send-scheduled-emails', {
    headers: authHeader ? { authorization: authHeader } : {},
  });

describe('GET /api/cron/send-scheduled-emails', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    // By default, claim succeeds (count: 1)
    mockUpdateMany.mockResolvedValue({ count: 1 });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('auth', () => {
    it('returns 401 when CRON_SECRET is set and no auth header is sent', async () => {
      process.env.CRON_SECRET = 'secret-abc';
      mockFindMany.mockResolvedValue([]);

      const { status } = await parseResponse(await GET(makeRequest()));
      expect(status).toBe(401);
    });

    it('returns 401 when CRON_SECRET is set and wrong secret is sent', async () => {
      process.env.CRON_SECRET = 'secret-abc';
      mockFindMany.mockResolvedValue([]);

      const { status } = await parseResponse(await GET(makeRequest('Bearer wrong-secret')));
      expect(status).toBe(401);
    });

    it('proceeds when CRON_SECRET is set and correct Bearer token is sent', async () => {
      process.env.CRON_SECRET = 'secret-abc';
      mockFindMany.mockResolvedValue([]);

      const { status } = await parseResponse(await GET(makeRequest('Bearer secret-abc')));
      expect(status).toBe(200);
    });

    it('proceeds without auth when CRON_SECRET is not set', async () => {
      delete process.env.CRON_SECRET;
      mockFindMany.mockResolvedValue([]);

      const { status } = await parseResponse(await GET(makeRequest()));
      expect(status).toBe(200);
    });
  });

  describe('job processing', () => {
    beforeEach(() => {
      delete process.env.CRON_SECRET;
    });

    it('returns processed:0 when there are no overdue jobs', async () => {
      mockFindMany.mockResolvedValue([]);

      const { status, data } = await parseResponse(await GET(makeRequest()));
      expect(status).toBe(200);
      expect(data.processed).toBe(0);
      expect(mockSendTier).not.toHaveBeenCalled();
    });

    it('atomically claims the job before sending by setting sentAt', async () => {
      mockFindMany.mockResolvedValue([makeJob({ id: 'job-99' })]);

      await parseResponse(await GET(makeRequest()));

      expect(mockUpdateMany).toHaveBeenCalledWith({
        where: { id: 'job-99', sentAt: null },
        data: { sentAt: expect.any(Date) },
      });
    });

    it('calls sendTierAnnouncementEmails with correct ride, tier, and notifyMode', async () => {
      mockFindMany.mockResolvedValue([makeJob({ tier: 'core', notifyMode: 'all' })]);

      await parseResponse(await GET(makeRequest()));

      expect(mockSendTier).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'ride-1' }),
        'core',
        'all'
      );
    });

    it('processes multiple jobs and returns correct counts', async () => {
      mockFindMany.mockResolvedValue([
        makeJob({ id: 'job-1', tier: 'core' }),
        makeJob({ id: 'job-2', tier: 't2w' }),
        makeJob({ id: 'job-3', tier: 'rider_guest' }),
      ]);

      const { data } = await parseResponse(await GET(makeRequest()));

      expect(mockSendTier).toHaveBeenCalledTimes(3);
      expect(data.processed).toBe(3);
      expect(data.sent).toBe(3);
      expect(data.failed).toBe(0);
    });

    it('skips a job and increments skipped when updateMany claim returns count 0', async () => {
      mockUpdateMany.mockResolvedValue({ count: 0 });
      mockFindMany.mockResolvedValue([makeJob({ id: 'job-already-claimed' })]);

      const { data } = await parseResponse(await GET(makeRequest()));

      expect(mockSendTier).not.toHaveBeenCalled();
      expect(data.skipped).toBe(1);
      expect(data.sent).toBe(0);
    });

    it('claims job before sending even when the send subsequently fails', async () => {
      mockSendTier.mockRejectedValue(new Error('SMTP error'));
      mockFindMany.mockResolvedValue([makeJob({ id: 'job-fail' })]);

      const { data } = await parseResponse(await GET(makeRequest()));

      // sentAt is stamped before the send attempt — avoids retry spam
      expect(mockUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'job-fail', sentAt: null } })
      );
      expect(data.failed).toBe(1);
      expect(data.sent).toBe(0);
    });

    it('increments failed count and continues when a job throws', async () => {
      mockSendTier
        .mockRejectedValueOnce(new Error('SMTP error'))
        .mockResolvedValue(undefined);

      mockFindMany.mockResolvedValue([
        makeJob({ id: 'job-1', tier: 'core' }),
        makeJob({ id: 'job-2', tier: 't2w' }),
      ]);

      const { data } = await parseResponse(await GET(makeRequest()));

      expect(data.processed).toBe(2);
      expect(data.sent).toBe(1);
      expect(data.failed).toBe(1);
      // Both jobs are claimed (updateMany called for each)
      expect(mockUpdateMany).toHaveBeenCalledTimes(2);
    });

    it('only queries jobs where scheduledAt <= now AND sentAt is null', async () => {
      mockFindMany.mockResolvedValue([]);

      await parseResponse(await GET(makeRequest()));

      const queryArg = mockFindMany.mock.calls[0][0];
      expect(queryArg.where.sentAt).toBeNull();
      expect(queryArg.where.scheduledAt.lte).toBeInstanceOf(Date);
    });
  });
});
