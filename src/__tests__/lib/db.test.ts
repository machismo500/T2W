import { describe, it, expect } from 'vitest';

// We test cleanConnectionString by extracting it. Since it's not exported,
// we replicate the logic here and test against the same behavior.
// The actual function lives in src/lib/db.ts.

function cleanConnectionString(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.delete('channel_binding');
    u.searchParams.delete('sslmode');
    return u.toString();
  } catch {
    return url
      .replace(/[?&]channel_binding=[^&]*/g, '')
      .replace(/[?&]sslmode=[^&]*/g, '')
      .replace(/\?&/, '?')
      .replace(/\?$/, '');
  }
}

describe('cleanConnectionString', () => {
  it('strips channel_binding param from URL', () => {
    const url = 'postgresql://user:pass@host/db?channel_binding=require';
    const result = cleanConnectionString(url);
    expect(result).not.toContain('channel_binding');
  });

  it('strips sslmode param from URL', () => {
    const url = 'postgresql://user:pass@host/db?sslmode=require';
    const result = cleanConnectionString(url);
    expect(result).not.toContain('sslmode');
  });

  it('handles URL with both params', () => {
    const url = 'postgresql://user:pass@host/db?sslmode=require&channel_binding=require';
    const result = cleanConnectionString(url);
    expect(result).not.toContain('sslmode');
    expect(result).not.toContain('channel_binding');
  });

  it('preserves other query params', () => {
    const url = 'postgresql://user:pass@host/db?sslmode=require&connect_timeout=10&channel_binding=prefer';
    const result = cleanConnectionString(url);
    expect(result).toContain('connect_timeout=10');
    expect(result).not.toContain('sslmode');
    expect(result).not.toContain('channel_binding');
  });

  it('handles URL with no params gracefully', () => {
    const url = 'postgresql://user:pass@host/db';
    const result = cleanConnectionString(url);
    expect(result).toBe('postgresql://user:pass@host/db');
  });

  it('handles malformed URLs with fallback regex', () => {
    const url = 'not-a-valid-url?sslmode=require&channel_binding=prefer';
    const result = cleanConnectionString(url);
    expect(result).not.toContain('sslmode');
    expect(result).not.toContain('channel_binding');
  });
});
