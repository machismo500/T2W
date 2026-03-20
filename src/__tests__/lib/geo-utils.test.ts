import { describe, it, expect } from 'vitest';
import {
  haversineDistance,
  pointToSegmentDistance,
  isOnRoute,
  pathDistanceKm,
} from '@/lib/geo-utils';

describe('geo-utils', () => {
  describe('haversineDistance', () => {
    it('returns 0 for identical points', () => {
      const point = { lat: 12.9716, lng: 77.5946 }; // Bangalore
      expect(haversineDistance(point, point)).toBe(0);
    });

    it('calculates correct distance between known cities', () => {
      const bangalore = { lat: 12.9716, lng: 77.5946 };
      const chennai = { lat: 13.0827, lng: 80.2707 };
      const distance = haversineDistance(bangalore, chennai) / 1000; // km
      // Bangalore to Chennai is ~290 km
      expect(distance).toBeGreaterThan(280);
      expect(distance).toBeLessThan(300);
    });

    it('is symmetric (a→b equals b→a)', () => {
      const a = { lat: 12.9716, lng: 77.5946 };
      const b = { lat: 13.0827, lng: 80.2707 };
      expect(haversineDistance(a, b)).toBeCloseTo(haversineDistance(b, a), 5);
    });

    it('handles antipodal points', () => {
      const a = { lat: 0, lng: 0 };
      const b = { lat: 0, lng: 180 };
      const distance = haversineDistance(a, b) / 1000; // km
      // Half Earth circumference ~20015 km
      expect(distance).toBeGreaterThan(20000);
      expect(distance).toBeLessThan(20100);
    });

    it('handles negative coordinates', () => {
      const a = { lat: -33.8688, lng: 151.2093 }; // Sydney
      const b = { lat: 51.5074, lng: -0.1278 }; // London
      const distance = haversineDistance(a, b) / 1000;
      // Sydney to London is ~16990 km
      expect(distance).toBeGreaterThan(16800);
      expect(distance).toBeLessThan(17200);
    });
  });

  describe('pointToSegmentDistance', () => {
    it('returns 0 when point is on segment endpoint', () => {
      const segA = { lat: 12.0, lng: 77.0 };
      const segB = { lat: 13.0, lng: 78.0 };
      const distance = pointToSegmentDistance(segA, segA, segB);
      expect(distance).toBeCloseTo(0, 0);
    });

    it('handles degenerate segment (both endpoints same)', () => {
      const point = { lat: 12.5, lng: 77.5 };
      const segPoint = { lat: 12.0, lng: 77.0 };
      const distance = pointToSegmentDistance(point, segPoint, segPoint);
      expect(distance).toBeCloseTo(haversineDistance(point, segPoint), 0);
    });

    it('returns distance to nearest endpoint when projection falls outside', () => {
      const segA = { lat: 12.0, lng: 77.0 };
      const segB = { lat: 12.0, lng: 78.0 };
      // Point far behind segment start
      const point = { lat: 12.0, lng: 76.0 };
      const distToA = haversineDistance(point, segA);
      const distToSegment = pointToSegmentDistance(point, segA, segB);
      expect(distToSegment).toBeCloseTo(distToA, -1);
    });

    it('returns small distance for point near middle of segment', () => {
      const segA = { lat: 12.0, lng: 77.0 };
      const segB = { lat: 12.0, lng: 78.0 };
      // Point slightly north of segment midpoint
      const point = { lat: 12.001, lng: 77.5 };
      const distance = pointToSegmentDistance(point, segA, segB);
      expect(distance).toBeLessThan(200); // should be ~111 meters
    });
  });

  describe('isOnRoute', () => {
    const route = [
      { lat: 12.0, lng: 77.0 },
      { lat: 12.5, lng: 77.5 },
      { lat: 13.0, lng: 78.0 },
    ];

    it('returns true for empty route', () => {
      expect(isOnRoute({ lat: 0, lng: 0 }, [])).toBe(true);
    });

    it('returns true when point is on route within tolerance', () => {
      const point = { lat: 12.25, lng: 77.25 }; // near first segment
      expect(isOnRoute(point, route)).toBe(true);
    });

    it('returns false when point is far off route', () => {
      const point = { lat: 20.0, lng: 85.0 }; // way off
      expect(isOnRoute(point, route)).toBe(false);
    });

    it('handles single-point route', () => {
      const singleRoute = [{ lat: 12.0, lng: 77.0 }];
      const nearPoint = { lat: 12.0001, lng: 77.0001 };
      const farPoint = { lat: 20.0, lng: 85.0 };
      expect(isOnRoute(nearPoint, singleRoute)).toBe(true);
      expect(isOnRoute(farPoint, singleRoute)).toBe(false);
    });

    it('respects custom tolerance', () => {
      // Point perpendicular to route (~1.5km north of midpoint, off the diagonal)
      const point = { lat: 12.26, lng: 77.24 }; // off to the side of the route
      expect(isOnRoute(point, route, 5000)).toBe(true); // 5km tolerance
      expect(isOnRoute(point, route, 100)).toBe(false); // 100m tolerance
    });
  });

  describe('pathDistanceKm', () => {
    it('returns 0 for empty array', () => {
      expect(pathDistanceKm([])).toBe(0);
    });

    it('returns 0 for single point', () => {
      expect(pathDistanceKm([{ lat: 12.0, lng: 77.0 }])).toBe(0);
    });

    it('correctly sums multi-segment path', () => {
      const points = [
        { lat: 12.0, lng: 77.0 },
        { lat: 12.5, lng: 77.5 },
        { lat: 13.0, lng: 78.0 },
      ];
      const totalKm = pathDistanceKm(points);
      const seg1 = haversineDistance(points[0], points[1]) / 1000;
      const seg2 = haversineDistance(points[1], points[2]) / 1000;
      expect(totalKm).toBeCloseTo(seg1 + seg2, 5);
    });

    it('returns result in kilometers not meters', () => {
      const points = [
        { lat: 12.9716, lng: 77.5946 }, // Bangalore
        { lat: 13.0827, lng: 80.2707 }, // Chennai
      ];
      const km = pathDistanceKm(points);
      expect(km).toBeGreaterThan(280);
      expect(km).toBeLessThan(300);
    });
  });
});
