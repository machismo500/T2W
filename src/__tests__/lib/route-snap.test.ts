import { describe, it, expect, vi } from "vitest";
import {
  snapWaypointsToRoads,
  type DirectionsServiceLike,
  type LatLng,
} from "@/lib/route-snap";

// A tiny fake DirectionsService that pretends every "snap" stretches each
// straight segment to 1.5× its length (mimicking switchback expansion) and
// returns a path that just contains the request points (good enough to
// validate batching / join-dedup behaviour).
function makeFakeService(stretchFactor = 1.5): DirectionsServiceLike & {
  calls: number;
} {
  const svc = {
    calls: 0,
    route: vi.fn(async (req) => {
      svc.calls++;
      const waypoints = [
        req.origin,
        ...(req.waypoints ?? []).map((w) => w.location),
        req.destination,
      ];
      let meters = 0;
      const legs = [];
      for (let i = 1; i < waypoints.length; i++) {
        const a = waypoints[i - 1];
        const b = waypoints[i];
        const dLat = (b.lat - a.lat) * 111_000;
        const dLng = (b.lng - a.lng) * 111_000;
        const baseM = Math.sqrt(dLat * dLat + dLng * dLng);
        const legM = baseM * stretchFactor;
        meters += legM;
        legs.push({
          distance: { value: Math.round(legM) },
          steps: [{ path: [a, b] }],
        });
      }
      return {
        routes: [
          {
            legs,
            overview_path: waypoints,
          },
        ],
      };
    }),
  };
  return svc as DirectionsServiceLike & { calls: number };
}

describe("snapWaypointsToRoads", () => {
  it("rejects fewer than 2 waypoints", async () => {
    const svc = makeFakeService();
    await expect(snapWaypointsToRoads([], svc)).rejects.toThrow(/at least 2/);
    await expect(
      snapWaypointsToRoads([{ lat: 0, lng: 0 }], svc)
    ).rejects.toThrow(/at least 2/);
  });

  it("issues one Directions call for ≤25 waypoints", async () => {
    const svc = makeFakeService();
    const waypoints: LatLng[] = Array.from({ length: 20 }, (_, i) => ({
      lat: 12 + i * 0.01,
      lng: 77 + i * 0.01,
    }));
    const result = await snapWaypointsToRoads(waypoints, svc);
    expect(svc.calls).toBe(1);
    expect(result.batches).toBe(1);
    expect(result.path.length).toBe(20);
  });

  it("batches and stitches paths for >25 waypoints", async () => {
    const svc = makeFakeService();
    // 51 points → batch sizes [25, 25, 2] with overlapping endpoints
    // (cursor advances by 24 each time after the first batch).
    const waypoints: LatLng[] = Array.from({ length: 51 }, (_, i) => ({
      lat: 12 + i * 0.01,
      lng: 77 + i * 0.01,
    }));
    const result = await snapWaypointsToRoads(waypoints, svc);
    expect(svc.calls).toBeGreaterThanOrEqual(2);
    expect(result.batches).toBe(svc.calls);
    // No duplicate join points: total stitched path = sum of batch sizes
    // minus (batches - 1) duplicated overlaps.
    expect(result.path.length).toBe(51);
  });

  it("returns a distance that exceeds straight-line haversine", async () => {
    const svc = makeFakeService(1.5);
    const waypoints: LatLng[] = [
      { lat: 12, lng: 77 },
      { lat: 13, lng: 78 },
    ];
    const result = await snapWaypointsToRoads(waypoints, svc);
    // ~157 km straight × 1.5 ≈ 235 km road
    expect(result.distanceKm).toBeGreaterThan(200);
    expect(result.distanceKm).toBeLessThan(260);
  });

  it("propagates errors when Directions returns no route", async () => {
    const svc: DirectionsServiceLike = {
      route: vi.fn(async () => ({ routes: [] })),
    };
    await expect(
      snapWaypointsToRoads(
        [
          { lat: 12, lng: 77 },
          { lat: 13, lng: 78 },
        ],
        svc
      )
    ).rejects.toThrow(/no route/i);
  });
});
