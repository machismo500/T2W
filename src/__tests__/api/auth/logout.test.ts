import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseResponse } from '@/__tests__/helpers';

// Mock next/headers
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  }),
}));

// Mock auth functions
vi.mock('@/lib/auth', () => ({
  removeAuthCookie: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from '@/app/api/auth/logout/route';
import { removeAuthCookie } from '@/lib/auth';

describe('POST /api/auth/logout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls removeAuthCookie', async () => {
    const res = await POST();
    await parseResponse(res);

    expect(removeAuthCookie).toHaveBeenCalled();
  });

  it('returns success true', async () => {
    const res = await POST();
    const { status, data } = await parseResponse(res);

    expect(status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('returns 500 when removeAuthCookie throws', async () => {
    vi.mocked(removeAuthCookie).mockRejectedValueOnce(new Error('Cookie error'));

    const res = await POST();
    const { status, data } = await parseResponse(res);

    expect(status).toBe(500);
    expect(data.error).toBe('Something went wrong');
  });
});
