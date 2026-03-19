// Geographical utility functions for live ride tracking

export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6371000; // meters

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Haversine distance between two points in meters */
export function haversineDistance(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Minimum distance from a point to a line segment (A→B) in meters */
export function pointToSegmentDistance(
  point: LatLng,
  segA: LatLng,
  segB: LatLng
): number {
  const dAB = haversineDistance(segA, segB);
  if (dAB < 1) return haversineDistance(point, segA); // degenerate segment

  // Project point onto segment using flat approximation (valid for short segments)
  const cosLat = Math.cos(toRad((segA.lat + segB.lat) / 2));
  const ax = segA.lng * cosLat;
  const ay = segA.lat;
  const bx = segB.lng * cosLat;
  const by = segB.lat;
  const px = point.lng * cosLat;
  const py = point.lat;

  const dx = bx - ax;
  const dy = by - ay;
  let t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t));

  const closestLng = (ax + t * dx) / cosLat;
  const closestLat = ay + t * dy;

  return haversineDistance(point, { lat: closestLat, lng: closestLng });
}

/** Check if a point is within tolerance of a route (array of waypoints) */
export function isOnRoute(
  point: LatLng,
  route: LatLng[],
  toleranceMeters: number = 200
): boolean {
  if (route.length === 0) return true; // no route = can't deviate
  if (route.length === 1) {
    return haversineDistance(point, route[0]) <= toleranceMeters;
  }

  for (let i = 0; i < route.length - 1; i++) {
    const dist = pointToSegmentDistance(point, route[i], route[i + 1]);
    if (dist <= toleranceMeters) return true;
  }
  return false;
}

/** Calculate total distance along a path of points in km */
export function pathDistanceKm(points: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineDistance(points[i - 1], points[i]);
  }
  return total / 1000;
}
