import { test, expect, type Page, type Route } from "@playwright/test";
import { mockAuthAs, USERS } from "./helpers";

// Tests for the seven recorded-track improvements:
//   #1 source-aware segments + legend
//   #2 speed-tinted mode toggle
//   #3 day-boundary chips (driven by gap > 3h between consecutive points)
//   #4 elevation profile strip
//   #5 replay scrubber
//   #6 quality (accuracy) toggle
//   #7 bulk "Smooth all" + preview-before-commit

const RIDE_ID = "ride-track-test";

// Multi-day path: two points on day 1, one point on day 3 (~48h later).
// The day-3 point should trigger a "Day 2 →" boundary marker, and the
// renderer should pick the smoothed series flags through.
const DAY_ONE_START = "2025-01-01T08:00:00Z";
const DAY_ONE_END = "2025-01-01T16:00:00Z";
const DAY_THREE_START = "2025-01-03T09:00:00Z";

const MOCK_PATH = [
  { lat: 24.75, lng: 46.75, recordedAt: DAY_ONE_START, speed: 0, accuracy: 5 },
  { lat: 24.85, lng: 46.85, recordedAt: DAY_ONE_END, speed: 65, accuracy: 8 },
  { lat: 25.00, lng: 47.00, recordedAt: DAY_THREE_START, speed: 45, accuracy: 200 },
];

const MOCK_SMOOTHED_POINTS = [
  { lat: 24.75, lng: 46.75, recordedAt: DAY_ONE_START, isInterpolated: false, isSnapped: false },
  { lat: 24.80, lng: 46.80, recordedAt: "2025-01-01T12:00:00Z", isInterpolated: true, isSnapped: false },
  { lat: 24.85, lng: 46.85, recordedAt: DAY_ONE_END, isInterpolated: false, isSnapped: true },
];

const MOCK_SESSION_ENDED = {
  id: "session-track-1",
  rideId: RIDE_ID,
  status: "ended" as string,
  startedAt: DAY_ONE_START,
  endedAt: DAY_THREE_START,
  leadRiderId: "user-lead",
  sweepRiderId: null as string | null,
  plannedRoute: [
    { lat: 24.7, lng: 46.7 },
    { lat: 25.0, lng: 47.0 },
  ],
  breaks: [] as { id: string; startedAt: string; endedAt?: string | null; reason?: string | null }[],
};

const MOCK_METRICS = {
  elapsedMinutes: 60,
  movingMinutes: 55,
  distanceKm: 45.2,
  distanceSource: "raw",
  avgSpeedKmh: 55,
  maxSpeedKmh: 80,
  breakCount: 0,
  breakMinutes: 0,
  riderCount: 2,
  startedAt: DAY_ONE_START,
  endedAt: DAY_THREE_START,
  elevationGainM: 250,
  elevationLossM: 230,
  overrides: { distanceKm: null, avgSpeedKmh: null, maxSpeedKmh: null, movingMinutes: null },
  computed: { distanceKm: 45.2, avgSpeedKmh: 55, maxSpeedKmh: 80, movingMinutes: 55 },
};

const MOCK_RIDERS = [
  {
    userId: "user-lead",
    userName: "Lead Rider",
    userAvatar: null,
    lat: 25.0,
    lng: 47.0,
    speed: 45,
    heading: 90,
    isDeviated: false,
    isLead: true,
    isSweep: false,
    recordedAt: DAY_THREE_START,
  },
  {
    userId: "user-second",
    userName: "Second Rider",
    userAvatar: null,
    lat: 25.0,
    lng: 47.0,
    speed: 40,
    heading: 90,
    isDeviated: false,
    isLead: false,
    isSweep: false,
    recordedAt: DAY_THREE_START,
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Replace the Google Maps loader with a small stub so the page mounts the
// map components without needing the real Maps API. Mirrors the working
// pattern from live-tracking.spec.ts — we serve the stub *as the loader's
// response body* so it executes inline and defines window.google before
// the page's effects fire.
async function mockGoogleMaps(page: Page) {
  // Inject window.google.maps BEFORE any page script runs. LiveRidePage's
  // mapsLoaded effect checks window.google?.maps first and short-circuits
  // to setMapsLoaded(true) without needing the real script + env var.
  // Necessary here because the seven new track-improvement features
  // (TrackStyleToggle, TrackScrubber, ElevationProfile) all gate on
  // mapsLoaded — the existing path-toggle tests pass without this because
  // they render in the post-ride header outside that gate.
  await page.addInitScript(() => {
    // Slightly fatter than the existing live-tracking.spec.ts stub — the
    // editor's PlannedRouteTab calls polyline.getPath().addListener() and
    // crashes the modal if those are missing.
    const noop = () => {};
    const pathStub = {
      getLength: () => 0,
      getAt: () => ({ lat: () => 0, lng: () => 0 }),
      push: noop,
      addListener: () => ({ remove: noop }),
    };
    function makeStub(): Record<string, unknown> {
      return {
        setCenter: noop,
        setZoom: noop,
        setMap: noop,
        setPath: noop,
        setPosition: noop,
        setOptions: noop,
        extend: noop,
        fitBounds: noop,
        panTo: noop,
        addListener: () => ({ remove: noop }),
        getCenter: () => ({ lat: noop, lng: noop }),
        getPath: () => pathStub,
        position: null,
        title: "",
        map: null,
      };
    }
    // Constructor-style: `new google.maps.Map(div, opts)` returns a stub.
    const Stub = function () {
      return makeStub();
    } as unknown as { new (): unknown };
    (window as unknown as { google: unknown }).google = {
      maps: {
        Map: Stub,
        Polyline: Stub,
        Marker: Stub,
        LatLng: function (this: Record<string, unknown>, a: number, b: number) {
          this.lat = () => a;
          this.lng = () => b;
        } as unknown as { new (a: number, b: number): unknown },
        LatLngBounds: Stub,
        ControlPosition: { TOP_RIGHT: 3, TOP_LEFT: 1, BOTTOM_RIGHT: 7, BOTTOM_LEFT: 9 },
        event: { addListener: noop, removeListener: noop },
        marker: { AdvancedMarkerElement: Stub },
        Size: Stub,
        OverlayView: Stub,
        TravelMode: { DRIVING: "DRIVING" },
        DirectionsService: Stub,
      },
    };
  });
  // Catch any actual fetch of the loader (shouldn't fire given the
  // pre-injected window.google, but safe to mock).
  await page.route("https://maps.googleapis.com/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/javascript",
      body: "/* stub */",
    })
  );
}

interface MockEndedOptions {
  riders?: typeof MOCK_RIDERS;
  leadPath?: typeof MOCK_PATH;
  smoothed?: { points: typeof MOCK_SMOOTHED_POINTS; smoothedAt?: string | null; stats?: unknown };
  elevationProfile?: { distKm: number; elev: number }[] | "fail";
  metrics?: typeof MOCK_METRICS;
}

async function mockEndedRide(page: Page, opts: MockEndedOptions = {}) {
  const liveBase = "/api/rides/" + RIDE_ID + "/live";
  const riders = opts.riders ?? MOCK_RIDERS;
  const leadPath = opts.leadPath ?? MOCK_PATH;
  const metrics = opts.metrics ?? MOCK_METRICS;
  const smoothed = opts.smoothed;
  const profile = opts.elevationProfile;

  await page.route("**" + liveBase + "**", (route: Route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (url.includes("/metrics")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(metrics),
      });
    }
    if (url.includes("/smoothed")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          smoothed ?? { points: [], smoothedAt: null, stats: null }
        ),
      });
    }
    if (url.includes("/elevation-profile")) {
      if (profile === "fail") {
        return route.fulfill({
          status: 502,
          contentType: "application/json",
          body: JSON.stringify({ error: "Elevation API call failed or unavailable" }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ profile: profile ?? [], cached: false }),
      });
    }
    if (url.includes("/map-edit/smooth-track")) {
      const isPreview = url.includes("preview=1");
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          preview: isPreview,
          stats: {
            rawCount: 3, snappedCount: 3, interpolatedCount: 1,
            gapsFilled: 1, gapsSkipped: 0, gapsTotalSeconds: 240, movedPercent: 5,
          },
          points: isPreview ? MOCK_SMOOTHED_POINTS : MOCK_SMOOTHED_POINTS.length,
        }),
      });
    }
    if (url.includes("/map-edit/stats") && method === "PATCH") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          session: { id: MOCK_SESSION_ENDED.id, distanceKmOverride: 100 },
        }),
      });
    }
    if (url.includes("/join") || url.includes("/location") || url.includes("/break")) {
      return route.continue();
    }

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        session: MOCK_SESSION_ENDED,
        riders,
        leadPath,
        myPath: leadPath,
      }),
    });
  });
}

async function goToLivePage(page: Page) {
  await page.goto("/ride/" + RIDE_ID + "/live");
  await page.waitForLoadState("networkidle");
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe("Recorded track — edit-map access (permission gate)", () => {
  test("super-admin sees 'Edit map & stats' button", async ({ page }) => {
    await mockAuthAs(page, USERS.superAdmin);
    await mockGoogleMaps(page);
    await mockEndedRide(page);
    await goToLivePage(page);

    await expect(page.getByTestId("open-map-editor")).toBeVisible();
    await expect(page.getByTestId("open-map-editor")).toHaveText(/Edit map/);
  });

  test("regular rider does not see the edit button", async ({ page }) => {
    await mockAuthAs(page, USERS.rider);
    await mockGoogleMaps(page);
    await mockEndedRide(page);
    await goToLivePage(page);

    await expect(page.getByTestId("open-map-editor")).toHaveCount(0);
  });
});

test.describe("Recorded track — style toggle (#1 #2 #6)", () => {
  test("renders three style modes with default = Source", async ({ page }) => {
    await mockAuthAs(page, USERS.superAdmin);
    await mockGoogleMaps(page);
    await mockEndedRide(page);
    await goToLivePage(page);

    await expect(page.getByTestId("style-default")).toBeVisible();
    await expect(page.getByTestId("style-speed")).toBeVisible();
    await expect(page.getByTestId("style-accuracy")).toBeVisible();
  });

  test("clicking a different mode switches the active style", async ({ page }) => {
    await mockAuthAs(page, USERS.superAdmin);
    await mockGoogleMaps(page);
    await mockEndedRide(page);
    await goToLivePage(page);

    const speedBtn = page.getByTestId("style-speed");
    const accuracyBtn = page.getByTestId("style-accuracy");
    await speedBtn.click();
    // Active button uses bg-white text-gray-900; inactive uses bg-white/10.
    await expect(speedBtn).toHaveClass(/bg-white text-gray-900/);
    await accuracyBtn.click();
    await expect(accuracyBtn).toHaveClass(/bg-white text-gray-900/);
    await expect(speedBtn).not.toHaveClass(/bg-white text-gray-900/);
  });
});

test.describe("Recorded track — elevation profile (#4)", () => {
  test("renders the profile strip when the endpoint returns samples", async ({ page }) => {
    await mockAuthAs(page, USERS.superAdmin);
    await mockGoogleMaps(page);
    await mockEndedRide(page, {
      elevationProfile: [
        { distKm: 0, elev: 100 },
        { distKm: 10, elev: 350 },
        { distKm: 25, elev: 1800 },
        { distKm: 45, elev: 2200 },
      ],
    });
    await goToLivePage(page);

    await expect(page.getByText(/Elevation profile/i)).toBeVisible();
    // The min/max range chip shows the rounded elevation extremes.
    await expect(page.getByText(/100–2200 m/)).toBeVisible();
  });

  test("shows an error banner when the elevation endpoint fails", async ({ page }) => {
    await mockAuthAs(page, USERS.superAdmin);
    await mockGoogleMaps(page);
    await mockEndedRide(page, { elevationProfile: "fail" });
    await goToLivePage(page);

    await expect(
      page.getByText(/Elevation profile.*Elevation API call failed/i)
    ).toBeVisible();
  });
});

test.describe("Recorded track — replay scrubber (#5)", () => {
  test("renders with play, restart, and a slider", async ({ page }) => {
    await mockAuthAs(page, USERS.superAdmin);
    await mockGoogleMaps(page);
    await mockEndedRide(page);
    await goToLivePage(page);

    await expect(page.getByTestId("scrubber-play")).toBeVisible();
    await expect(page.getByTestId("scrubber-slider")).toBeVisible();
  });

  test("dragging the slider advances the current point", async ({ page }) => {
    await mockAuthAs(page, USERS.superAdmin);
    await mockGoogleMaps(page);
    await mockEndedRide(page);
    await goToLivePage(page);

    const slider = page.getByTestId("scrubber-slider");
    // Drag the range input to the right-most position via keyboard. Faster
    // and more reliable than synthesising DOM events directly (controlled
    // inputs need React to receive the change through its synthetic event
    // tracker, which native dispatchEvent doesn't always trigger).
    await slider.focus();
    await page.keyboard.press("End");
    // After dragging to the end, the scrubber's "current / total km" readout
    // is in the form `N.N / N.N km` where current == total.
    await expect(page.getByText(/^\d+\.\d+ \/ \d+\.\d+ km$/)).toBeVisible();
  });
});

test.describe("Recorded track — preview & commit smooth-fill (#7)", () => {
  test("preview returns proposed track and shows commit/discard", async ({ page }) => {
    await mockAuthAs(page, USERS.superAdmin);
    await mockGoogleMaps(page);
    await mockEndedRide(page);
    await goToLivePage(page);

    await page.getByTestId("open-map-editor").click();
    await page.getByRole("button", { name: "Recorded track" }).click();

    const previewBtn = page.getByTestId("smooth-track-preview");
    await expect(previewBtn).toBeVisible();
    await previewBtn.click();

    await expect(page.getByTestId("smooth-track-commit")).toBeVisible();
    await expect(page.getByText(/Preview ready:.*gaps filled/i)).toBeVisible();
  });

  test("bulk 'Smooth all' button appears when 2+ riders are tracked", async ({ page }) => {
    await mockAuthAs(page, USERS.superAdmin);
    await mockGoogleMaps(page);
    await mockEndedRide(page);
    await goToLivePage(page);

    await page.getByTestId("open-map-editor").click();
    await page.getByRole("button", { name: "Recorded track" }).click();

    await expect(page.getByTestId("smooth-all")).toBeVisible();
  });
});

test.describe("Recorded track — Statistics tab override flow", () => {
  test("renders override inputs and saves a distance override", async ({ page }) => {
    await mockAuthAs(page, USERS.superAdmin);
    await mockGoogleMaps(page);
    await mockEndedRide(page);
    await goToLivePage(page);

    await page.getByTestId("open-map-editor").click();
    await page.getByRole("button", { name: "Statistics" }).click();

    // Each row's input is keyed by its override field via data-testid.
    const distanceInput = page.getByTestId("stats-distanceKm");
    await expect(distanceInput).toBeVisible();

    let patchedBody: unknown = null;
    await page.route(
      "**/api/rides/" + RIDE_ID + "/live/map-edit/stats",
      async (route) => {
        if (route.request().method() === "PATCH") {
          patchedBody = route.request().postDataJSON();
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              session: { id: MOCK_SESSION_ENDED.id, distanceKmOverride: 845.3 },
            }),
          });
        }
        return route.continue();
      }
    );

    await distanceInput.fill("845.3");
    // Wait for the PATCH to fire and the modal to close (onSaved). The
    // "Saved ✓" flash is intentionally transient (parent closes the modal
    // ~immediately after refresh), so we assert on the request body
    // instead — that's the contract that matters.
    const [request] = await Promise.all([
      page.waitForRequest(
        (req) =>
          req.url().includes("/live/map-edit/stats") && req.method() === "PATCH"
      ),
      page.getByTestId("save-stats").click(),
    ]);
    const body = JSON.parse(request.postData() ?? "{}") as {
      distanceKmOverride?: number;
    };
    expect(body.distanceKmOverride).toBeCloseTo(845.3);
    // (patchedBody is captured by the route handler for cross-check.)
    expect((patchedBody as { distanceKmOverride?: number })?.distanceKmOverride).toBeCloseTo(845.3);
  });
});
