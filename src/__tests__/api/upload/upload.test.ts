import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseResponse } from '@/__tests__/helpers';

vi.mock('@/lib/db', () => ({
  prisma: {
    riderProfile: { update: vi.fn(), findUnique: vi.fn() },
  },
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}));

import { POST } from '@/app/api/upload/route';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { NextRequest } from 'next/server';

function createFormDataRequest(fields: Record<string, string | File>): NextRequest {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, value);
  }
  return new NextRequest(new URL('http://localhost:3000/api/upload'), {
    method: 'POST',
    body: formData,
  });
}

describe('POST /api/upload', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const req = createFormDataRequest({ dataUrl: 'data:image/png;base64,abc' });
    const res = await POST(req);
    const { status, data } = await parseResponse(res);
    expect(status).toBe(401);
    expect(data.error).toContain('Not authenticated');
  });

  it('returns 400 when no file or dataUrl provided', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', role: 'rider' } as any);

    const formData = new FormData();
    const req = new NextRequest(new URL('http://localhost:3000/api/upload'), {
      method: 'POST',
      body: formData,
    });
    const res = await POST(req);
    const { status, data } = await parseResponse(res);
    expect(status).toBe(400);
    expect(data.error).toContain('No file');
  });

  it('returns url when dataUrl is provided without avatar type', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', role: 'rider' } as any);

    const req = createFormDataRequest({ dataUrl: 'data:image/png;base64,abc123' });
    const res = await POST(req);
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.url).toBe('data:image/png;base64,abc123');
  });

  it('persists avatar to DB for owner', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: 'u1', role: 'rider', linkedRiderId: 'rider-1',
    } as any);
    vi.mocked(prisma.riderProfile.update).mockResolvedValue({} as any);

    const req = createFormDataRequest({
      dataUrl: 'data:image/png;base64,abc',
      type: 'avatar',
      targetId: 'rider-1',
    });
    const res = await POST(req);
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.persisted).toBe(true);
    expect(prisma.riderProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'rider-1' },
        data: { avatarUrl: 'data:image/png;base64,abc' },
      })
    );
  });

  it('returns 403 when non-owner tries to update avatar', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: 'u1', role: 'rider', linkedRiderId: 'rider-99',
    } as any);

    const req = createFormDataRequest({
      dataUrl: 'data:image/png;base64,abc',
      type: 'avatar',
      targetId: 'rider-1',
    });
    const res = await POST(req);
    const { status, data } = await parseResponse(res);
    expect(status).toBe(403);
    expect(data.error).toContain('permission');
  });

  it('allows superadmin to update any avatar', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: 'u1', role: 'superadmin', linkedRiderId: 'rider-99',
    } as any);
    vi.mocked(prisma.riderProfile.update).mockResolvedValue({} as any);

    const req = createFormDataRequest({
      dataUrl: 'data:image/png;base64,abc',
      type: 'avatar',
      targetId: 'rider-1',
    });
    const res = await POST(req);
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.persisted).toBe(true);
  });

  it('converts uploaded file to base64 data URL', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', role: 'rider' } as any);

    const file = new File(['test-image-content'], 'photo.png', { type: 'image/png' });
    const req = createFormDataRequest({ file: file as any });
    const res = await POST(req);
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.url).toContain('data:image/png;base64,');
  });

  it('rejects non-image files', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', role: 'rider' } as any);

    const file = new File(['text content'], 'file.txt', { type: 'text/plain' });
    const req = createFormDataRequest({ file: file as any });
    const res = await POST(req);
    const { status, data } = await parseResponse(res);
    expect(status).toBe(400);
    expect(data.error).toContain('image');
  });
});
