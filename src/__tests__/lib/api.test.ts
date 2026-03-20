import { describe, it, expect } from 'vitest';
import { success, error } from '@/lib/api';

describe('api response helpers', () => {
  describe('success()', () => {
    it('returns NextResponse with status 200 by default', async () => {
      const res = success({ message: 'ok' });
      expect(res.status).toBe(200);
    });

    it('returns data as JSON body', async () => {
      const data = { rides: [{ id: '1', title: 'Test Ride' }] };
      const res = success(data);
      const body = await res.json();
      expect(body).toEqual(data);
    });

    it('accepts custom status code', async () => {
      const res = success({ created: true }, 201);
      expect(res.status).toBe(201);
    });
  });

  describe('error()', () => {
    it('returns NextResponse with status 400 by default', async () => {
      const res = error('Bad request');
      expect(res.status).toBe(400);
    });

    it('includes error message in body', async () => {
      const res = error('Not found');
      const body = await res.json();
      expect(body).toEqual({ error: 'Not found' });
    });

    it('accepts custom status code', async () => {
      const res = error('Unauthorized', 401);
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body).toEqual({ error: 'Unauthorized' });
    });

    it('handles empty error message', async () => {
      const res = error('');
      const body = await res.json();
      expect(body).toEqual({ error: '' });
    });
  });
});
