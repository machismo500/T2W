import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNextRequest, parseResponse } from '@/__tests__/helpers';

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
  },
}));

// Mock OTP store
vi.mock('@/lib/otp-store', () => ({
  createEmailOtp: vi.fn().mockResolvedValue('123456'),
}));

// Mock nodemailer — use vi.hoisted so the variable is available in the hoisted factory
const { mockSendMail } = vi.hoisted(() => ({
  mockSendMail: vi.fn().mockResolvedValue({ messageId: 'mock-id' }),
}));
vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn().mockReturnValue({ sendMail: mockSendMail }),
  },
}));

import { POST } from '@/app/api/auth/send-otp/route';
import { prisma } from '@/lib/db';
import { createEmailOtp } from '@/lib/otp-store';

describe('POST /api/auth/send-otp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
  });

  it('returns 400 for missing email', async () => {
    const req = createNextRequest('http://localhost:3000/api/auth/send-otp', {
      method: 'POST',
      body: {},
    });
    const res = await POST(req);
    const { status, data } = await parseResponse(res);
    expect(status).toBe(400);
    expect(data.error).toContain('valid email');
  });

  it('returns 400 for invalid email format', async () => {
    const req = createNextRequest('http://localhost:3000/api/auth/send-otp', {
      method: 'POST',
      body: { email: 'invalid-email' },
    });
    const res = await POST(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(400);
  });

  it('returns 409 if account already exists', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'user-1' } as any);

    const req = createNextRequest('http://localhost:3000/api/auth/send-otp', {
      method: 'POST',
      body: { email: 'existing@example.com' },
    });
    const res = await POST(req);
    const { status, data } = await parseResponse(res);
    expect(status).toBe(409);
    expect(data.error).toContain('already exists');
  });

  it('returns 503 when SMTP is not configured', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const req = createNextRequest('http://localhost:3000/api/auth/send-otp', {
      method: 'POST',
      body: { email: 'new@example.com' },
    });
    const res = await POST(req);
    const { status, data } = await parseResponse(res);
    expect(status).toBe(503);
    expect(data.error).toContain('not configured');
    expect(createEmailOtp).toHaveBeenCalledWith('new@example.com');
  });

  it('sends OTP email when SMTP is configured', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    process.env.SMTP_USER = 'smtp@test.com';
    process.env.SMTP_PASS = 'password123';

    const req = createNextRequest('http://localhost:3000/api/auth/send-otp', {
      method: 'POST',
      body: { email: 'new@example.com' },
    });
    const res = await POST(req);
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockSendMail).toHaveBeenCalled();
  });

  it('normalizes email to lowercase', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const req = createNextRequest('http://localhost:3000/api/auth/send-otp', {
      method: 'POST',
      body: { email: 'TEST@EXAMPLE.COM' },
    });
    await POST(req);

    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'test@example.com' } })
    );
    expect(createEmailOtp).toHaveBeenCalledWith('test@example.com');
  });

  it('returns 502 when email sending fails', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    process.env.SMTP_USER = 'smtp@test.com';
    process.env.SMTP_PASS = 'password123';
    mockSendMail.mockRejectedValueOnce(new Error('SMTP connection failed'));

    const req = createNextRequest('http://localhost:3000/api/auth/send-otp', {
      method: 'POST',
      body: { email: 'new@example.com' },
    });
    const res = await POST(req);
    const { status, data } = await parseResponse(res);
    expect(status).toBe(502);
    expect(data.error).toContain('Failed to send');
  });
});
