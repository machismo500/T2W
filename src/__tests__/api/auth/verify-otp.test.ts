import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNextRequest, parseResponse } from '@/__tests__/helpers';

vi.mock('@/lib/otp-store', () => ({
  verifyEmailOtp: vi.fn(),
}));

import { POST } from '@/app/api/auth/verify-otp/route';
import { verifyEmailOtp } from '@/lib/otp-store';

describe('POST /api/auth/verify-otp', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 when email is missing', async () => {
    const req = createNextRequest('http://localhost:3000/api/auth/verify-otp', {
      method: 'POST',
      body: { code: '123456' },
    });
    const res = await POST(req);
    const { status, data } = await parseResponse(res);
    expect(status).toBe(400);
    expect(data.error).toContain('required');
  });

  it('returns 400 when code is missing', async () => {
    const req = createNextRequest('http://localhost:3000/api/auth/verify-otp', {
      method: 'POST',
      body: { email: 'test@example.com' },
    });
    const res = await POST(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(400);
  });

  it('returns 400 for invalid or expired code', async () => {
    vi.mocked(verifyEmailOtp).mockResolvedValue(false);

    const req = createNextRequest('http://localhost:3000/api/auth/verify-otp', {
      method: 'POST',
      body: { email: 'test@example.com', code: '999999' },
    });
    const res = await POST(req);
    const { status, data } = await parseResponse(res);
    expect(status).toBe(400);
    expect(data.error).toContain('Invalid or expired');
  });

  it('returns success for valid code', async () => {
    vi.mocked(verifyEmailOtp).mockResolvedValue(true);

    const req = createNextRequest('http://localhost:3000/api/auth/verify-otp', {
      method: 'POST',
      body: { email: 'test@example.com', code: '123456' },
    });
    const res = await POST(req);
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.verified).toBe(true);
  });
});
