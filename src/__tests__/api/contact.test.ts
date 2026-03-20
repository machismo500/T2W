import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNextRequest, parseResponse } from '@/__tests__/helpers';

vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn().mockReturnValue({
      sendMail: vi.fn().mockResolvedValue({ messageId: 'mock-id' }),
    }),
  },
}));

import { POST } from '@/app/api/contact/route';

describe('POST /api/contact', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    // Clear SMTP env vars by default
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns 400 for missing fields', async () => {
    const req = createNextRequest('http://localhost:3000/api/contact', {
      method: 'POST',
      body: { name: '', email: '', subject: '', message: '' },
    });
    const { status, data } = await parseResponse(await POST(req));

    expect(status).toBe(400);
    expect(data.error).toContain('required');
  });

  it('returns 400 for missing some fields', async () => {
    const req = createNextRequest('http://localhost:3000/api/contact', {
      method: 'POST',
      body: { name: 'Test', email: 'test@example.com', subject: '', message: '' },
    });
    const { status, data } = await parseResponse(await POST(req));

    expect(status).toBe(400);
    expect(data.error).toContain('required');
  });

  it('returns 400 for invalid email (no @)', async () => {
    const req = createNextRequest('http://localhost:3000/api/contact', {
      method: 'POST',
      body: { name: 'Test', email: 'invalid-email', subject: 'Hello', message: 'Test message' },
    });
    const { status, data } = await parseResponse(await POST(req));

    expect(status).toBe(400);
    expect(data.error).toContain('valid email');
  });

  it('returns 503 if SMTP not configured', async () => {
    process.env.SMTP_USER = '';
    process.env.SMTP_PASS = '';

    const req = createNextRequest('http://localhost:3000/api/contact', {
      method: 'POST',
      body: { name: 'Test', email: 'test@example.com', subject: 'Hello', message: 'Test message' },
    });
    const { status, data } = await parseResponse(await POST(req));

    expect(status).toBe(503);
    expect(data.error).toContain('not configured');
  });
});
