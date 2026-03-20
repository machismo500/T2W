import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNextRequest, parseResponse, mockSuperAdmin, mockRider } from '@/__tests__/helpers';

vi.mock('@/lib/db', () => ({
  prisma: {
    notification: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}));

import { GET, POST, PUT } from '@/app/api/notifications/route';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

const mockGetCurrentUser = getCurrentUser as ReturnType<typeof vi.fn>;
const mockFindMany = prisma.notification.findMany as ReturnType<typeof vi.fn>;
const mockCreate = prisma.notification.create as ReturnType<typeof vi.fn>;
const mockUpdate = prisma.notification.update as ReturnType<typeof vi.fn>;

describe('GET /api/notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns global notifications when not authenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const notifications = [
      { id: 'n-1', title: 'Global', message: 'Hello all', userId: null, date: new Date(), isRead: false },
    ];
    mockFindMany.mockResolvedValue(notifications);

    const { status, data } = await parseResponse(await GET());

    expect(status).toBe(200);
    expect(data.notifications).toHaveLength(1);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: null },
      })
    );
  });

  it('returns global + user-specific notifications when authenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(mockRider);
    mockFindMany.mockResolvedValue([]);

    await GET();

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ userId: mockRider.id }, { userId: null }] },
      })
    );
  });
});

describe('POST /api/notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 403 for non-admin', async () => {
    mockGetCurrentUser.mockResolvedValue(mockRider);

    const req = createNextRequest('http://localhost:3000/api/notifications', {
      method: 'POST',
      body: { title: 'Test', message: 'Hello' },
    });
    const { status, data } = await parseResponse(await POST(req));

    expect(status).toBe(403);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 400 for missing title/message', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);

    const req = createNextRequest('http://localhost:3000/api/notifications', {
      method: 'POST',
      body: { title: '', message: '' },
    });
    const { status, data } = await parseResponse(await POST(req));

    expect(status).toBe(400);
    expect(data.error).toContain('required');
  });

  it('creates notification (status 201)', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);
    const created = { id: 'n-new', title: 'Ride Update', message: 'New ride posted', type: 'info', userId: null };
    mockCreate.mockResolvedValue(created);

    const req = createNextRequest('http://localhost:3000/api/notifications', {
      method: 'POST',
      body: { title: 'Ride Update', message: 'New ride posted' },
    });
    const { status, data } = await parseResponse(await POST(req));

    expect(status).toBe(201);
    expect(data.notification.title).toBe('Ride Update');
  });
});

describe('PUT /api/notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 for unauthenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const req = createNextRequest('http://localhost:3000/api/notifications', {
      method: 'PUT',
      body: { id: 'n-1' },
    });
    const { status, data } = await parseResponse(await PUT(req));

    expect(status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('marks notification as read', async () => {
    mockGetCurrentUser.mockResolvedValue(mockRider);
    mockUpdate.mockResolvedValue({ id: 'n-1', isRead: true });

    const req = createNextRequest('http://localhost:3000/api/notifications', {
      method: 'PUT',
      body: { id: 'n-1' },
    });
    const { status, data } = await parseResponse(await PUT(req));

    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'n-1' },
      data: { isRead: true },
    });
  });
});
