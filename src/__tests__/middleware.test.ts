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

  // ---------------------------------------------------------------------------
  // HTTPS enforcement
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // Bad user-agent blocking
  // ---------------------------------------------------------------------------
  describe('bad user-agent blocking', () => {
    const maliciousAgents = [
      'sqlmap/1.7',
      'nikto/2.1.6',
      'nmap scripting engine',
      'masscan/1.3',
      'gobuster/3.1',
      'nuclei/2.9',
      'hydra v9.4',
      'metasploit',
      'burpsuite',
      'acunetix',
    ];

    for (const ua of maliciousAgents) {
      it(`blocks user-agent: ${ua}`, () => {
        const req = createRequest('http://localhost:3000/api/rides', {
          'user-agent': ua,
        });
        const res = middleware(req);
        expect(res.status).toBe(403);
      });
    }

    it('passes through legitimate browser user-agent', () => {
      const req = createRequest('http://localhost:3000/api/rides', {
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      });
      const res = middleware(req);
      expect(res.status).toBe(200);
    });
  });

  // ---------------------------------------------------------------------------
  // SQL injection detection
  // ---------------------------------------------------------------------------
  describe('SQL injection detection', () => {
    it('blocks SELECT statement in query string', () => {
      const req = createRequest('http://localhost:3000/api/rides?q=SELECT%20*%20FROM%20users');
      expect(middleware(req).status).toBe(400);
    });

    it('blocks UNION SELECT injection', () => {
      const req = createRequest('http://localhost:3000/api/rides?id=1%20UNION%20SELECT%20password%20FROM%20users');
      expect(middleware(req).status).toBe(400);
    });

    it('blocks DROP TABLE (percent-encoded space)', () => {
      const req = createRequest('http://localhost:3000/api/rides?q=DROP%20TABLE%20users');
      expect(middleware(req).status).toBe(400);
    });

    it('blocks DROP TABLE (+ encoded space)', () => {
      const req = createRequest('http://localhost:3000/api/rides?q=DROP+TABLE+users');
      expect(middleware(req).status).toBe(400);
    });

    it('blocks classic OR 1=1 (percent-encoded)', () => {
      const req = createRequest('http://localhost:3000/api/rides?id=1%20OR%201%3D1');
      expect(middleware(req).status).toBe(400);
    });

    it('blocks OR 1=1 with + encoding', () => {
      const req = createRequest('http://localhost:3000/api/rides?id=1+OR+1%3D1');
      expect(middleware(req).status).toBe(400);
    });

    it('blocks AND 1=1 boolean injection', () => {
      const req = createRequest('http://localhost:3000/api/rides?id=1%20AND%201%3D1');
      expect(middleware(req).status).toBe(400);
    });

    it("blocks quote-based OR injection (' OR '1'='1)", () => {
      const req = createRequest("http://localhost:3000/api/rides?id=1%27%20OR%20%271%27%3D%271");
      expect(middleware(req).status).toBe(400);
    });

    it('blocks SQL comment terminator --', () => {
      const req = createRequest('http://localhost:3000/api/rides?id=1--');
      expect(middleware(req).status).toBe(400);
    });

    it('blocks time-based blind: SLEEP()', () => {
      const req = createRequest('http://localhost:3000/api/rides?id=1%20AND%20SLEEP(5)');
      expect(middleware(req).status).toBe(400);
    });

    it('blocks WAITFOR DELAY', () => {
      const req = createRequest("http://localhost:3000/api/rides?q=1%3BWAITFOR%20DELAY%20'0%3A0%3A5'");
      expect(middleware(req).status).toBe(400);
    });

    it('passes through benign query with + (name search)', () => {
      const req = createRequest('http://localhost:3000/api/rides?search=John+Doe');
      expect(middleware(req).status).toBe(200);
    });

    it('passes through benign date filter', () => {
      const req = createRequest('http://localhost:3000/api/rides?from=2024-01-01&to=2024-12-31');
      expect(middleware(req).status).toBe(200);
    });
  });

  // ---------------------------------------------------------------------------
  // XSS detection
  // ---------------------------------------------------------------------------
  describe('XSS detection', () => {
    it('blocks <script> tag', () => {
      const req = createRequest('http://localhost:3000/api/rides?q=%3Cscript%3Ealert(1)%3C%2Fscript%3E');
      expect(middleware(req).status).toBe(400);
    });

    it('blocks javascript: protocol', () => {
      const req = createRequest('http://localhost:3000/api/rides?url=javascript%3Aalert(1)');
      expect(middleware(req).status).toBe(400);
    });

    it('blocks vbscript: protocol', () => {
      const req = createRequest('http://localhost:3000/api/rides?url=vbscript%3Aalert(1)');
      expect(middleware(req).status).toBe(400);
    });

    it('blocks onerror event handler', () => {
      const req = createRequest('http://localhost:3000/api/rides?x=%3Cimg+onerror%3Dalert(1)%3E');
      expect(middleware(req).status).toBe(400);
    });

    it('blocks onclick event handler', () => {
      const req = createRequest('http://localhost:3000/api/rides?x=onclick%3Dsteal()');
      expect(middleware(req).status).toBe(400);
    });

    it('blocks eval()', () => {
      const req = createRequest('http://localhost:3000/api/rides?x=eval(atob(payload))');
      expect(middleware(req).status).toBe(400);
    });
  });

  // ---------------------------------------------------------------------------
  // Path traversal detection
  // ---------------------------------------------------------------------------
  describe('path traversal detection', () => {
    it('blocks ../ traversal', () => {
      const req = createRequest('http://localhost:3000/api/rides?file=../../etc/passwd');
      expect(middleware(req).status).toBe(400);
    });

    it('blocks URL-encoded ../ traversal (%2e%2e%2f)', () => {
      const req = createRequest('http://localhost:3000/api/rides?file=%2e%2e%2fetc%2fpasswd');
      expect(middleware(req).status).toBe(400);
    });

    it('blocks double-encoded traversal (%252e%252e)', () => {
      const req = createRequest('http://localhost:3000/api/rides?file=%252e%252e%252fetc%252fpasswd');
      expect(middleware(req).status).toBe(400);
    });

    it('passes through normal path parameter', () => {
      const req = createRequest('http://localhost:3000/api/rides?sort=startDate&dir=asc');
      expect(middleware(req).status).toBe(200);
    });
  });

  // ---------------------------------------------------------------------------
  // Command injection detection
  // ---------------------------------------------------------------------------
  describe('command injection detection', () => {
    it('blocks semicolon + ls command', () => {
      const req = createRequest('http://localhost:3000/api/rides?x=foo;ls%20-la');
      expect(middleware(req).status).toBe(400);
    });

    it('blocks pipe + cat command', () => {
      const req = createRequest('http://localhost:3000/api/rides?x=foo|cat%20/etc/passwd');
      expect(middleware(req).status).toBe(400);
    });

    it('blocks backtick + whoami', () => {
      const req = createRequest('http://localhost:3000/api/rides?x=foo%60whoami%60');
      expect(middleware(req).status).toBe(400);
    });
  });

  // ---------------------------------------------------------------------------
  // SSRF detection
  // ---------------------------------------------------------------------------
  describe('SSRF detection', () => {
    it('blocks localhost in query', () => {
      const req = createRequest('http://localhost:3000/api/rides?url=http%3A%2F%2Flocalhost%2Fadmin');
      expect(middleware(req).status).toBe(400);
    });

    it('blocks 127.0.0.1 in query', () => {
      const req = createRequest('http://localhost:3000/api/rides?url=http%3A%2F%2F127.0.0.1%3A8080');
      expect(middleware(req).status).toBe(400);
    });

    it('blocks 169.254 metadata IP', () => {
      const req = createRequest('http://localhost:3000/api/rides?url=http%3A%2F%2F169.254.169.254%2Flatest%2Fmeta-data');
      expect(middleware(req).status).toBe(400);
    });
  });

  // ---------------------------------------------------------------------------
  // Rate limiting
  // ---------------------------------------------------------------------------
  describe('rate limiting', () => {
    it('allows requests under the limit', () => {
      const req = createRequest('http://localhost:3000/api/rides', {
        'x-forwarded-for': '192.168.99.1',
      });
      // First few requests should pass
      expect(middleware(req).status).toBe(200);
      expect(middleware(req).status).toBe(200);
    });

    it('blocks auth route after exceeding auth limit', () => {
      const ip = '10.0.0.55';
      const authReq = () =>
        createRequest('http://localhost:3000/api/auth/login', {
          'x-forwarded-for': ip,
        });
      // Auth limit is 10 per minute — exhaust it
      for (let i = 0; i < 10; i++) {
        middleware(authReq());
      }
      const res = middleware(authReq());
      expect(res.status).toBe(429);
    });

    it('returns JSON error on rate limit', () => {
      const ip = '10.0.0.66';
      const authReq = () =>
        createRequest('http://localhost:3000/api/auth/register', {
          'x-forwarded-for': ip,
        });
      for (let i = 0; i < 10; i++) {
        middleware(authReq());
      }
      const res = middleware(authReq());
      expect(res.status).toBe(429);
      expect(res.headers.get('content-type')).toContain('application/json');
    });
  });

  // ---------------------------------------------------------------------------
  // config.matcher
  // ---------------------------------------------------------------------------
  describe('config.matcher', () => {
    it('has a matcher pattern defined', () => {
      expect(config.matcher).toBeDefined();
      expect(config.matcher.length).toBeGreaterThan(0);
    });

    it('matcher pattern excludes static files', () => {
      const pattern = config.matcher[0];
      expect(pattern).toContain('_next/static');
      expect(pattern).toContain('favicon.ico');
    });
  });
});
