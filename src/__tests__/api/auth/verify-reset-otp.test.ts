import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNextRequest, parseResponse } from '@/__tests__/helpers';

vi.mock('@/lib/otp-store', () => ({
  verifyResetOtp: vi.fn(),
}));

import { POST } from '@/app/api/auth/verify-reset-otp/route';
import { verifyResetOtp } from '@/lib/otp-store';

describe('POST /api/auth/verify-reset-otp', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 when email is missing', async () => {
    const req = createNextRequest('http://localhost:3000/api/auth/verify-reset-otp', {
      method: 'POST',
      body: { code: '123456' },
    });
    const res = await POST(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(400);
  });

  it('returns 400 when code is missing', async () => {
    const req = createNextRequest('http://localhost:3000/api/auth/verify-reset-otp', {
      method: 'POST',
      body: { email: 'test@example.com' },
    });
    const res = await POST(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(400);
  });

  it('returns 400 for invalid or expired reset code', async () => {
    vi.mocked(verifyResetOtp).mockResolvedValue(false);

    const req = createNextRequest('http://localhost:3000/api/auth/verify-reset-otp', {
      method: 'POST',
      body: { email: 'test@example.com', code: '999999' },
    });
    const res = await POST(req);
    const { status, data } = await parseResponse(res);
    expect(status).toBe(400);
    expect(data.error).toContain('Invalid or expired');
  });

  it('returns success for valid reset code', async () => {
    vi.mocked(verifyResetOtp).mockResolvedValue(true);

    const req = createNextRequest('http://localhost:3000/api/auth/verify-reset-otp', {
      method: 'POST',
      body: { email: 'test@example.com', code: '654321' },
    });
    const res = await POST(req);
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.success).toBe(true);
  });
});
