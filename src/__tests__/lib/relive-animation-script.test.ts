import { describe, it, expect } from "vitest";
import {
  buildReliveScript,
  type ReliveScriptInput,
} from "@/lib/relive/animation-script";

const BANGALORE = { lat: 12.9716, lng: 77.5946 };

// Synthetic 100-point linear path heading roughly NE from Bangalore. Spaced
// at ~50m increments so we can sanity-check distance + bearing.
function syntheticPath(points: number) {
  const out: ReliveScriptInput["path"] = [];
  const baseTime = Date.parse("2025-01-01T08:00:00Z");
  for (let i = 0; i < points; i++) {
    out.push({
      lat: BANGALORE.lat + i * 0.0005,
      lng: BANGALORE.lng + i * 0.0005,
      speed: 40 + (i % 10) * 2,
      recordedAt: new Date(baseTime + i * 60_000).toISOString(),
    });
  }
  return out;
}

describe("relive animation-script", () => {
  it("builds a script and produces frames at all phases", () => {
    const script = buildReliveScript({
      path: syntheticPath(50),
      breaks: [],
      totalDistanceKm: 5,
      totalElevationGainM: 200,
      durationSec: 60,
    });

    expect(script.durationSec).toBe(60);
    expect(script.cumKm.length).toBe(50);
    expect(script.cumKm[script.cumKm.length - 1]).toBeGreaterThan(0);

    const intro = script.getStateAtTime(0.5);
    expect(intro.phase).toBe("intro");

    const flyover = script.getStateAtTime(30);
    expect(flyover.phase).toBe("flyover");
    expect(flyover.flyoverProgress).toBeGreaterThan(0);
    expect(flyover.flyoverProgress).toBeLessThan(1);
    expect(flyover.hud.kmCovered).toBeGreaterThan(0);

    const outro = script.getStateAtTime(58);
    expect(outro.phase).toBe("outro");
    expect(outro.hud.kmCovered).toBeCloseTo(script.cumKm[script.cumKm.length - 1], 1);
  });

  it("clamps duration to the [30, 90] range", () => {
    const tooShort = buildReliveScript({
      path: syntheticPath(10),
      totalDistanceKm: 1,
      durationSec: 5,
    });
    expect(tooShort.durationSec).toBe(30);

    const tooLong = buildReliveScript({
      path: syntheticPath(10),
      totalDistanceKm: 1,
      durationSec: 600,
    });
    expect(tooLong.durationSec).toBe(90);
  });

  it("throws when path has fewer than 2 valid points", () => {
    expect(() =>
      buildReliveScript({
        path: [{ lat: 12.97, lng: 77.59 }],
        totalDistanceKm: 0,
        durationSec: 60,
      })
    ).toThrow();
  });

  it("emits a top-speed highlight when speed data exists", () => {
    const script = buildReliveScript({
      path: syntheticPath(30),
      totalDistanceKm: 5,
      durationSec: 60,
    });
    expect(script.highlights.length).toBeGreaterThan(0);
    expect(script.highlights[0].label).toMatch(/Top speed/);
  });
});
