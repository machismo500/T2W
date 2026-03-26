import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseResponse } from '@/__tests__/helpers';

vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
    },
    riderProfile: {
      findMany: vi.fn(),
    },
  },
}));

import { GET } from '@/app/api/crew/route';
import { prisma } from '@/lib/db';

const mockUserFindMany = prisma.user.findMany as ReturnType<typeof vi.fn>;
const mockProfileFindMany = prisma.riderProfile.findMany as ReturnType<typeof vi.fn>;

describe('GET /api/crew', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns crew members from User table', async () => {
    mockUserFindMany.mockResolvedValue([
      {
        id: 'u1',
        name: 'Super Admin',
        email: 'admin@t2w.com',
        role: 'superadmin',
        linkedRiderId: 'r1',
        riderProfile: { id: 'r1', avatarUrl: 'avatar.jpg' },
      },
    ]);
    mockProfileFindMany.mockResolvedValue([]);

    const { status, data } = await parseResponse(await GET());

    expect(status).toBe(200);
    expect(data.crew).toHaveLength(1);
    expect(data.crew[0].name).toBe('Super Admin');
    expect(data.crew[0].role).toBe('superadmin');
    expect(data.crew[0].avatarUrl).toBe('avatar.jpg');
  });

  it('returns crew from RiderProfile table', async () => {
    mockUserFindMany.mockResolvedValue([]);
    mockProfileFindMany.mockResolvedValue([
      {
        id: 'r2',
        name: 'Core Rider',
        email: 'core@t2w.com',
        role: 'core_member',
        avatarUrl: null,
      },
    ]);

    const { data } = await parseResponse(await GET());

    expect(data.crew).toHaveLength(1);
    expect(data.crew[0].name).toBe('Core Rider');
    expect(data.crew[0].linkedRiderId).toBe('r2');
  });

  it('deduplicates by email', async () => {
    mockUserFindMany.mockResolvedValue([
      {
        id: 'u1',
        name: 'Admin',
        email: 'admin@t2w.com',
        role: 'superadmin',
        linkedRiderId: 'r1',
        riderProfile: { id: 'r1', avatarUrl: null },
      },
    ]);
    mockProfileFindMany.mockResolvedValue([
      {
        id: 'r1',
        name: 'Admin',
        email: 'admin@t2w.com',
        role: 'superadmin',
        avatarUrl: null,
      },
    ]);

    const { data } = await parseResponse(await GET());

    // Should only appear once (User takes precedence)
    expect(data.crew).toHaveLength(1);
    expect(data.crew[0].id).toBe('u1');
  });

  it('excludes T2W Official system account', async () => {
    mockUserFindMany.mockResolvedValue([
      {
        id: 'u-official',
        name: 'T2W Official',
        email: 'taleson2wheels.official@t2w.com',
        role: 'superadmin',
        linkedRiderId: null,
        riderProfile: null,
      },
    ]);
    mockProfileFindMany.mockResolvedValue([]);

    const { data } = await parseResponse(await GET());

    expect(data.crew).toHaveLength(0);
  });

  it('queries only superadmin and core_member roles', async () => {
    mockUserFindMany.mockResolvedValue([]);
    mockProfileFindMany.mockResolvedValue([]);

    await GET();

    expect(mockUserFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { role: { in: ['superadmin', 'core_member'] } },
      })
    );
    expect(mockProfileFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          role: { in: ['superadmin', 'core_member'] },
        }),
      })
    );
  });
});
