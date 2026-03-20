import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware, config } from '@/middleware';

function createRequest(
  url: string,
  headers: Record<string, string> = {}
): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    headers: new Headers(headers),
  });
}

describe('middleware', () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.stubEnv('NODE_ENV', originalEnv || 'test');
  });

  describe('HTTPS enforcement', () => {
    it('redirects HTTP to HTTPS in production for non-localhost', () => {
      vi.stubEnv('NODE_ENV', 'production');
      const req = createRequest('http://taleson2wheels.com/rides', {
        host: 'taleson2wheels.com',
        'x-forwarded-proto': 'http',
      });
      const res = middleware(req);
      expect(res.status).toBe(301);
      expect(res.headers.get('location')).toContain('https://');
    });

    it('redirects when x-forwarded-ssl is off', () => {
      vi.stubEnv('NODE_ENV', 'production');
      const req = createRequest('http://taleson2wheels.com/', {
        host: 'taleson2wheels.com',
        'x-forwarded-ssl': 'off',
      });
      const res = middleware(req);
      expect(res.status).toBe(301);
    });

    it('passes through HTTPS requests in production', () => {
      vi.stubEnv('NODE_ENV', 'production');
      const req = createRequest('https://taleson2wheels.com/', {
        host: 'taleson2wheels.com',
        'x-forwarded-proto': 'https',
      });
      const res = middleware(req);
      expect(res.status).toBe(200);
    });

    it('passes through for localhost in production', () => {
      vi.stubEnv('NODE_ENV', 'production');
      const req = createRequest('http://localhost:3000/', {
        host: 'localhost:3000',
        'x-forwarded-proto': 'http',
      });
      const res = middleware(req);
      expect(res.status).toBe(200);
    });

    it('passes through in development regardless of protocol', () => {
      vi.stubEnv('NODE_ENV', 'development');
      const req = createRequest('http://taleson2wheels.com/', {
        host: 'taleson2wheels.com',
        'x-forwarded-proto': 'http',
      });
      const res = middleware(req);
      expect(res.status).toBe(200);
    });
  });

  describe('config.matcher', () => {
    it('has a matcher pattern defined', () => {
      expect(config.matcher).toBeDefined();
      expect(config.matcher.length).toBeGreaterThan(0);
    });

    it('matcher pattern excludes static files', () => {
      const pattern = config.matcher[0];
      // The regex should exclude _next/static, images, etc.
      expect(pattern).toContain('_next/static');
      expect(pattern).toContain('favicon.ico');
    });
  });
});
