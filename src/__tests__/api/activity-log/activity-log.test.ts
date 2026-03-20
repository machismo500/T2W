import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNextRequest, parseResponse, mockSuperAdmin, mockCoreMember, mockRider } from '@/__tests__/helpers';

vi.mock('@/lib/db', () => ({
  prisma: {
    activityLog: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}));

import { GET, POST } from '@/app/api/activity-log/route';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

const mockGetCurrentUser = getCurrentUser as ReturnType<typeof vi.fn>;
const mockFindMany = prisma.activityLog.findMany as ReturnType<typeof vi.fn>;
const mockCreate = prisma.activityLog.create as ReturnType<typeof vi.fn>;

const mockEntry = {
  id: 'log-1',
  action: 'user_approved',
  performedBy: 'user-1',
  performedByName: 'Super Admin',
  targetId: 'user-3',
  targetName: 'Test Rider',
  details: 'Approved user account',
  rollbackData: '{"previousStatus":"pending"}',
  createdAt: new Date('2025-01-15T10:00:00Z'),
};

describe('GET /api/activity-log', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 403 for unauthenticated users', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const { status, data } = await parseResponse(await GET());

    expect(status).toBe(403);
    expect(data.error).toBe('Forbidden');
  });

  it('returns 403 for regular riders', async () => {
    mockGetCurrentUser.mockResolvedValue(mockRider);

    const { status } = await parseResponse(await GET());

    expect(status).toBe(403);
  });

  it('returns log entries for superadmin', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);
    mockFindMany.mockResolvedValue([mockEntry]);

    const { status, data } = await parseResponse(await GET());

    expect(status).toBe(200);
    expect(data.entries).toHaveLength(1);
    expect(data.entries[0].action).toBe('user_approved');
    expect(data.entries[0].rollbackData).toEqual({ previousStatus: 'pending' });
    expect(data.entries[0].timestamp).toBe('2025-01-15T10:00:00.000Z');
  });

  it('returns log entries for core_member', async () => {
    mockGetCurrentUser.mockResolvedValue(mockCoreMember);
    mockFindMany.mockResolvedValue([]);

    const { status, data } = await parseResponse(await GET());

    expect(status).toBe(200);
    expect(data.entries).toEqual([]);
  });

  it('fetches last 200 entries sorted by createdAt desc', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);
    mockFindMany.mockResolvedValue([]);

    await GET();

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'desc' },
        take: 200,
      })
    );
  });

  it('handles null rollbackData', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);
    mockFindMany.mockResolvedValue([{ ...mockEntry, rollbackData: null }]);

    const { data } = await parseResponse(await GET());

    expect(data.entries[0].rollbackData).toBeUndefined();
  });
});

describe('POST /api/activity-log', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 403 for unauthenticated users', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const req = createNextRequest('http://localhost:3000/api/activity-log', {
      method: 'POST',
      body: { action: 'test_action' },
    });
    const { status } = await parseResponse(await POST(req));

    expect(status).toBe(403);
  });

  it('returns 403 for regular riders', async () => {
    mockGetCurrentUser.mockResolvedValue(mockRider);

    const req = createNextRequest('http://localhost:3000/api/activity-log', {
      method: 'POST',
      body: { action: 'test_action' },
    });
    const { status } = await parseResponse(await POST(req));

    expect(status).toBe(403);
  });

  it('creates log entry for superadmin', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);
    mockCreate.mockResolvedValue({
      id: 'log-new',
      action: 'user_approved',
      createdAt: new Date('2025-02-01T12:00:00Z'),
    });

    const req = createNextRequest('http://localhost:3000/api/activity-log', {
      method: 'POST',
      body: {
        action: 'user_approved',
        targetId: 'user-3',
        targetName: 'Test Rider',
        details: 'Approved user',
      },
    });
    const { status, data } = await parseResponse(await POST(req));

    expect(status).toBe(200);
    expect(data.entry.id).toBe('log-new');
    expect(data.entry.action).toBe('user_approved');
  });

  it('uses current user as performer when not specified', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);
    mockCreate.mockResolvedValue({ id: 'log-new', action: 'test', createdAt: new Date() });

    const req = createNextRequest('http://localhost:3000/api/activity-log', {
      method: 'POST',
      body: { action: 'test_action' },
    });
    await POST(req);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          performedBy: mockSuperAdmin.id,
          performedByName: mockSuperAdmin.name,
        }),
      })
    );
  });

  it('stringifies rollbackData when provided', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);
    mockCreate.mockResolvedValue({ id: 'log-new', action: 'test', createdAt: new Date() });

    const rollback = { previousRole: 'rider' };
    const req = createNextRequest('http://localhost:3000/api/activity-log', {
      method: 'POST',
      body: { action: 'role_change', rollbackData: rollback },
    });
    await POST(req);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rollbackData: JSON.stringify(rollback),
        }),
      })
    );
  });
});
