import { describe, it, expect } from "vitest";
import { decodePolyline } from "@/lib/roads-api";

describe("decodePolyline", () => {
  // Reference example straight from the Google polyline-encoding docs:
  // (38.5, -120.2) → (40.7, -120.95) → (43.252, -126.453).
  it("decodes the canonical Google example", () => {
    const encoded = "_p~iF~ps|U_ulLnnqC_mqNvxq`@";
    const points = decodePolyline(encoded);
    expect(points).toHaveLength(3);
    expect(points[0].lat).toBeCloseTo(38.5, 4);
    expect(points[0].lng).toBeCloseTo(-120.2, 4);
    expect(points[1].lat).toBeCloseTo(40.7, 4);
    expect(points[1].lng).toBeCloseTo(-120.95, 4);
    expect(points[2].lat).toBeCloseTo(43.252, 4);
    expect(points[2].lng).toBeCloseTo(-126.453, 4);
  });

  it("returns an empty array for empty input", () => {
    expect(decodePolyline("")).toEqual([]);
  });
});
