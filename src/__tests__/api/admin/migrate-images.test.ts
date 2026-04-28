import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNextRequest, parseResponse, mockSuperAdmin, mockRider, mockCoreMember } from '@/__tests__/helpers';

vi.mock('@/lib/db', () => ({
  prisma: {
    user: { count: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    riderProfile: { count: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    motorcycle: { count: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    ride: { count: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    blogPost: { count: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    ridePost: { count: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  },
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/lib/blob-upload', () => ({
  uploadImage: vi.fn(),
}));

import { GET, POST } from '@/app/api/admin/migrate-images/route';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { uploadImage } from '@/lib/blob-upload';

const FAKE_BLOB_URL = 'https://abc.public.blob.vercel-storage.com/avatar/x/png-1.png';

function zeroAllCounts() {
  vi.mocked(prisma.user.count).mockResolvedValue(0);
  vi.mocked(prisma.riderProfile.count).mockResolvedValue(0);
  vi.mocked(prisma.motorcycle.count).mockResolvedValue(0);
  vi.mocked(prisma.ride.count).mockResolvedValue(0);
  vi.mocked(prisma.blogPost.count).mockResolvedValue(0);
  vi.mocked(prisma.ridePost.count).mockResolvedValue(0);
}

function emptyAllFindMany() {
  vi.mocked(prisma.user.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.riderProfile.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.motorcycle.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.ride.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.blogPost.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.ridePost.findMany).mockResolvedValue([] as never);
}

describe('GET /api/admin/migrate-images', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BLOB_READ_WRITE_TOKEN = 'test-token';
  });

  it('rejects unauthenticated requests', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const res = await GET();
    const { status } = await parseResponse(res);
    expect(status).toBe(401);
  });

  it('rejects non-superadmin users', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockRider as never);
    const res = await GET();
    const { status, data } = await parseResponse(res);
    expect(status).toBe(403);
    expect(data.error).toContain('Superadmin');
  });

  it('rejects core_member', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockCoreMember as never);
    const res = await GET();
    const { status } = await parseResponse(res);
    expect(status).toBe(403);
  });

  it('returns counts and total for superadmin', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockSuperAdmin as never);
    vi.mocked(prisma.user.count).mockResolvedValue(3);
    vi.mocked(prisma.riderProfile.count).mockResolvedValue(2);
    vi.mocked(prisma.motorcycle.count).mockResolvedValue(0);
    vi.mocked(prisma.ride.count).mockResolvedValue(1);
    vi.mocked(prisma.blogPost.count).mockResolvedValue(0);
    vi.mocked(prisma.ridePost.count).mockResolvedValue(4);

    const res = await GET();
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.counts).toEqual({
      user: 3,
      riderProfile: 2,
      motorcycle: 0,
      ride: 1,
      blogPost: 0,
      ridePost: 4,
    });
    expect(data.total).toBe(10);
    expect(data.done).toBe(false);
    expect(data.blobReady).toBe(true);
  });

  it('reports done when all counts are zero', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockSuperAdmin as never);
    zeroAllCounts();
    const res = await GET();
    const { data } = await parseResponse(res);
    expect(data.total).toBe(0);
    expect(data.done).toBe(true);
  });

  it('flags blobReady=false when token is missing', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockSuperAdmin as never);
    delete process.env.BLOB_READ_WRITE_TOKEN;
    zeroAllCounts();
    const res = await GET();
    const { data } = await parseResponse(res);
    expect(data.blobReady).toBe(false);
  });
});

describe('POST /api/admin/migrate-images', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BLOB_READ_WRITE_TOKEN = 'test-token';
    vi.mocked(uploadImage).mockResolvedValue({
      url: FAKE_BLOB_URL,
      pathname: 'avatar/x/png-1.png',
      contentType: 'image/png',
    });
    emptyAllFindMany();
    zeroAllCounts();
  });

  it('rejects non-superadmin', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockRider as never);
    const req = createNextRequest('http://localhost/api/admin/migrate-images', {
      method: 'POST',
      body: { batch: 5 },
    });
    const res = await POST(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(403);
  });

  it('500s when BLOB_READ_WRITE_TOKEN is missing', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockSuperAdmin as never);
    delete process.env.BLOB_READ_WRITE_TOKEN;
    const req = createNextRequest('http://localhost/api/admin/migrate-images', {
      method: 'POST',
      body: { batch: 5 },
    });
    const res = await POST(req);
    const { status, data } = await parseResponse(res);
    expect(status).toBe(500);
    expect(data.error).toContain('BLOB_READ_WRITE_TOKEN');
  });

  it('migrates a User.avatar row and updates the DB', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockSuperAdmin as never);
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: 'u1', avatar: 'data:image/png;base64,abc' },
    ] as never);
    vi.mocked(prisma.user.update).mockResolvedValue({} as never);

    const req = createNextRequest('http://localhost/api/admin/migrate-images', {
      method: 'POST',
      body: { batch: 5 },
    });
    const res = await POST(req);
    const { status, data } = await parseResponse(res);

    expect(status).toBe(200);
    expect(uploadImage).toHaveBeenCalledWith(
      'data:image/png;base64,abc',
      expect.objectContaining({ type: 'avatar', scope: 'u1' })
    );
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { avatar: FAKE_BLOB_URL },
    });
    expect(data.migrated).toHaveLength(1);
    expect(data.migrated[0].table).toBe('User.avatar');
    expect(data.failed).toHaveLength(0);
  });

  it('records a failure and continues when uploadImage throws', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockSuperAdmin as never);
    vi.mocked(uploadImage).mockRejectedValueOnce(new Error('Blob 500'));
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: 'u-bad', avatar: 'data:image/png;base64,bad' },
    ] as never);

    const req = createNextRequest('http://localhost/api/admin/migrate-images', {
      method: 'POST',
      body: { batch: 5 },
    });
    const res = await POST(req);
    const { status, data } = await parseResponse(res);

    expect(status).toBe(200);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(data.failed).toEqual([
      { table: 'User.avatar', id: 'u-bad', error: 'Blob 500' },
    ]);
  });

  it('rewrites RidePost.images JSON array, leaving https entries untouched', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockSuperAdmin as never);
    vi.mocked(prisma.ridePost.findMany).mockResolvedValue([
      {
        id: 'rp1',
        images: JSON.stringify([
          'https://existing.example.com/keep.jpg',
          'data:image/png;base64,one',
          'data:image/jpeg;base64,two',
        ]),
      },
    ] as never);
    vi.mocked(prisma.ridePost.update).mockResolvedValue({} as never);

    const req = createNextRequest('http://localhost/api/admin/migrate-images', {
      method: 'POST',
      body: { batch: 50 },
    });
    const res = await POST(req);
    const { status, data } = await parseResponse(res);

    expect(status).toBe(200);
    expect(uploadImage).toHaveBeenCalledTimes(2);
    expect(prisma.ridePost.update).toHaveBeenCalledTimes(1);
    const updateCall = vi.mocked(prisma.ridePost.update).mock.calls[0][0];
    const persisted = JSON.parse((updateCall.data as { images: string }).images);
    expect(persisted[0]).toBe('https://existing.example.com/keep.jpg');
    expect(persisted[1]).toBe(FAKE_BLOB_URL);
    expect(persisted[2]).toBe(FAKE_BLOB_URL);
    expect(data.migrated.find((m: { table: string }) => m.table === 'RidePost.images')).toBeTruthy();
  });

  it('clamps batch size between 1 and 50', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockSuperAdmin as never);

    // Out-of-range high → clamped to 50, so findMany should still be called
    // with take: 50 not 9999.
    const req = createNextRequest('http://localhost/api/admin/migrate-images', {
      method: 'POST',
      body: { batch: 9999 },
    });
    await POST(req);
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 })
    );

    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(mockSuperAdmin as never);
    emptyAllFindMany();
    zeroAllCounts();

    // Out-of-range low → clamped to 1
    const req2 = createNextRequest('http://localhost/api/admin/migrate-images', {
      method: 'POST',
      body: { batch: 0 },
    });
    await POST(req2);
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 1 })
    );
  });

  it('reports done=true when nothing remains', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockSuperAdmin as never);
    const req = createNextRequest('http://localhost/api/admin/migrate-images', {
      method: 'POST',
      body: { batch: 5 },
    });
    const res = await POST(req);
    const { data } = await parseResponse(res);
    expect(data.total).toBe(0);
    expect(data.done).toBe(true);
    expect(data.migrated).toHaveLength(0);
  });
});
