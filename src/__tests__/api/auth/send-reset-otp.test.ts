import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNextRequest, parseResponse } from '@/__tests__/helpers';

vi.mock('@/lib/db', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
  },
}));

vi.mock('@/lib/otp-store', () => ({
  createResetOtp: vi.fn().mockResolvedValue('654321'),
}));

const { mockSendMail } = vi.hoisted(() => ({
  mockSendMail: vi.fn().mockResolvedValue({ messageId: 'mock-id' }),
}));
vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn().mockReturnValue({ sendMail: mockSendMail }),
  },
}));

import { POST } from '@/app/api/auth/send-reset-otp/route';
import { prisma } from '@/lib/db';
import { createResetOtp } from '@/lib/otp-store';

describe('POST /api/auth/send-reset-otp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
  });

  it('returns 400 when email is missing', async () => {
    const req = createNextRequest('http://localhost:3000/api/auth/send-reset-otp', {
      method: 'POST',
      body: {},
    });
    const res = await POST(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(400);
  });

  it('returns 200 silently when user does not exist (prevent enumeration)', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const req = createNextRequest('http://localhost:3000/api/auth/send-reset-otp', {
      method: 'POST',
      body: { email: 'noone@example.com' },
    });
    const res = await POST(req);
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.emailSent).toBe(false);
  });

  it('returns 503 when SMTP not configured', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'u1', name: 'Rider' } as any);

    const req = createNextRequest('http://localhost:3000/api/auth/send-reset-otp', {
      method: 'POST',
      body: { email: 'rider@example.com' },
    });
    const res = await POST(req);
    const { status, data } = await parseResponse(res);
    expect(status).toBe(503);
    expect(data.error).toContain('not configured');
    expect(createResetOtp).toHaveBeenCalledWith('rider@example.com');
  });

  it('sends reset email when SMTP configured', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'u1', name: 'Rider' } as any);
    process.env.SMTP_USER = 'smtp@test.com';
    process.env.SMTP_PASS = 'pass';

    const req = createNextRequest('http://localhost:3000/api/auth/send-reset-otp', {
      method: 'POST',
      body: { email: 'rider@example.com' },
    });
    const res = await POST(req);
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.emailSent).toBe(true);
    expect(mockSendMail).toHaveBeenCalled();
  });

  it('returns 502 when email sending fails', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'u1', name: 'Rider' } as any);
    process.env.SMTP_USER = 'smtp@test.com';
    process.env.SMTP_PASS = 'pass';
    mockSendMail.mockRejectedValueOnce(new Error('Connection refused'));

    const req = createNextRequest('http://localhost:3000/api/auth/send-reset-otp', {
      method: 'POST',
      body: { email: 'rider@example.com' },
    });
    const res = await POST(req);
    const { status, data } = await parseResponse(res);
    expect(status).toBe(502);
    expect(data.error).toContain('Failed to send');
  });
});
