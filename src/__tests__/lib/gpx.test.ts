import { describe, it, expect } from "vitest";
import { serializeGpx, parseGpx, gpxDistanceKm } from "@/lib/gpx";

describe("gpx", () => {
  it("round-trips lat/lng/time/ele through serialize -> parse", () => {
    const points = [
      { lat: 12.9716, lng: 77.5946, ele: 920, time: "2026-01-01T08:00:00.000Z" },
      { lat: 12.972, lng: 77.595, ele: 922, time: "2026-01-01T08:00:30.000Z" },
      { lat: 13.0, lng: 77.62 },
    ];
    const xml = serializeGpx({ name: "Test Ride", points });
    expect(xml).toContain('lat="12.971600"');
    expect(xml).toContain('lon="77.594600"');
    expect(xml).toContain("<ele>920.0</ele>");
    expect(xml).toContain("<time>2026-01-01T08:00:00.000Z</time>");

    const parsed = parseGpx(xml);
    expect(parsed.points.length).toBe(3);
    expect(parsed.points[0].lat).toBeCloseTo(12.9716, 4);
    expect(parsed.points[0].lng).toBeCloseTo(77.5946, 4);
    expect(parsed.points[0].ele).toBeCloseTo(920, 0);
    expect(parsed.points[2].ele).toBeUndefined();
  });

  it("rejects non-GPX input", () => {
    expect(() => parseGpx("<html><body></body></html>")).toThrow();
  });

  it("rejects oversize input", () => {
    const huge = "<gpx>" + "x".repeat(6 * 1024 * 1024) + "</gpx>";
    expect(() => parseGpx(huge)).toThrow(/too large/i);
  });

  it("ignores points with invalid lat/lng", () => {
    const xml = `<?xml version="1.0"?><gpx version="1.1"><trk><trkseg>
      <trkpt lat="91" lon="0"></trkpt>
      <trkpt lat="0" lon="181"></trkpt>
      <trkpt lat="12.97" lon="77.59"></trkpt>
    </trkseg></trk></gpx>`;
    const parsed = parseGpx(xml);
    expect(parsed.points.length).toBe(1);
    expect(parsed.points[0].lat).toBeCloseTo(12.97, 2);
  });

  it("parses self-closing trkpt nodes", () => {
    const xml = `<?xml version="1.0"?><gpx version="1.1"><trk><trkseg>
      <trkpt lat="12.97" lon="77.59" />
      <trkpt lat="12.98" lon="77.60" />
    </trkseg></trk></gpx>`;
    const parsed = parseGpx(xml);
    expect(parsed.points.length).toBe(2);
  });

  it("computes haversine distance for a short path", () => {
    const km = gpxDistanceKm([
      { lat: 12.9716, lng: 77.5946 },
      { lat: 13.0827, lng: 80.2707 },
    ]);
    expect(km).toBeGreaterThan(280);
    expect(km).toBeLessThan(300);
  });

  it("returns 0 distance for paths with <2 points", () => {
    expect(gpxDistanceKm([])).toBe(0);
    expect(gpxDistanceKm([{ lat: 0, lng: 0 }])).toBe(0);
  });
});
