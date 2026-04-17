import { test, expect, type Page } from "@playwright/test";
import { mockAuthAs, USERS } from "./helpers";

// ── Shared constants & mock data ──────────────────────────────────────────────

const RIDE_ID = "ride-live-test";
const BASE_URL = "http://localhost:3001";

const MOCK_SESSION_LIVE = {
  id: "session-live-1",
  rideId: RIDE_ID,
  status: "live",
  startedAt: new Date(Date.now() - 3_600_000).toISOString(),
  endedAt: null,
  leadRiderId: "user-lead",
  sweepRiderId: null,
  plannedRoute: [
    { lat: 24.7, lng: 46.7 },
    { lat: 24.8, lng: 46.8 },
  ],
  breaks: [],
};

const MOCK_SESSION_PAUSED = { ...MOCK_SESSION_LIVE, status: "paused" };

const MOCK_SESSION_ENDED = {
  ...MOCK_SESSION_LIVE,
  status: "ended",
  endedAt: new Date().toISOString(),
};

const MOCK_METRICS = {
  elapsedMinutes: 60,
  distanceKm: 45.2,
  avgSpeedKmh: 55,
  maxSpeedKmh: 80,
  breakCount: 0,
  breakMinutes: 0,
  riderCount: 2,
};

const MOCK_RIDERS = [
  {
    userId: "user-lead",
    userName: "Ahmed Lead",
    userAvatar: null,
    lat: 24.75,
    lng: 46.75,
    speed: 60,
    heading: 90,
    isDeviated: false,
    isLead: true,
    isSweep: false,
    recordedAt: new Date().toISOString(),
  },
  {
    userId: "user-rider",
    userName: "Test Rider",
    userAvatar: null,
    lat: 24.74,
    lng: 46.74,
    speed: 58,
    heading: 85,
    isDeviated: false,
    isLead: false,
    isSweep: false,
    recordedAt: new Date().toISOString(),
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Intercept the Google Maps script URL and return a no-op stub.
 * When the browser loads the stub, script.onload fires which sets
 * mapsLoaded=true in LiveRidePage, allowing the live-tracking UI to render.
 */
async function mockGoogleMaps(page: Page) {
  await page.route("https://maps.googleapis.com/**", (route) => {
    route.fulfill({
      status: 200,
      contentType: "text/javascript",
      body: [
        "var noop = function(){};",
        "function MapStub(){ this.setCenter=noop; this.setZoom=noop;",
        "  this.setMap=noop; this.setPath=noop; this.setPosition=noop;",
        "  this.extend=noop; this.addListener=function(){ return {remove:noop}; };",
        "  this.getCenter=function(){ return {lat:noop,lng:noop}; }; }",
        "window.google = { maps: {",
        "  Map: MapStub, Polyline: MapStub, Marker: MapStub,",
        "  LatLng: function(a,b){ this.lat=function(){return a;}; this.lng=function(){return b;}; },",
        "  LatLngBounds: MapStub,",
        "  event: { addListener: noop, removeListener: noop },",
        "  Size: MapStub, OverlayView: MapStub",
        "} };",
      ].join("\n"),
    });
  });
}

/**
 * Set up mocks for all live-session API endpoints.
 * Sub-routes are registered AFTER the general live route so
 * Playwright's "last match wins" rule routes them correctly.
 */
async function mockLiveApi(
  page: Page,
  session: typeof MOCK_SESSION_LIVE | null = MOCK_SESSION_LIVE
) {
  const liveBase = "/api/rides/" + RIDE_ID + "/live";

  // (1) General session endpoint — registered first (lower priority)
  await page.route("**" + liveBase + "**", (route) => {
    const url = route.request().url();
    // Sub-paths handled by higher-priority routes below
    if (
      url.includes("/metrics") ||
      url.includes("/join") ||
      url.includes("/location") ||
      url.includes("/break")
    ) {
      return route.continue();
    }

    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          session,
          riders: session ? MOCK_RIDERS : [],
          leadPath: [],
        }),
      });
    }
    // POST (session control)
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ session, action: "ok" }),
    });
  });

  // (2) Sub-routes — registered after (higher priority in Playwright)
  await page.route("**" + liveBase + "/metrics**", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_METRICS),
    });
  });

  await page.route("**" + liveBase + "/join**", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, session, isLead: false, isSweep: false }),
    });
  });

  await page.route("**" + liveBase + "/location**", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, isDeviated: false }),
    });
  });

  await page.route("**" + liveBase + "/break**", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        break: {
          id: "break-1",
          sessionId: "session-live-1",
          startedAt: new Date().toISOString(),
          endedAt: null,
          reason: null,
        },
      }),
    });
  });
}

async function goToLivePage(page: Page) {
  await page.goto("/ride/" + RIDE_ID + "/live");
  await page.waitForLoadState("networkidle");
}

// ── Group 1: Ride Detail Page — "Live Tracking" button visibility ─────────────

test.describe("Ride Detail Page — Live Tracking button", () => {
  const DETAIL_RIDE_ID = "ride-1";

  function mockRideAs(
    page: Page,
    status: "upcoming" | "ongoing" | "completed" | "cancelled"
  ) {
    return page.route("**/api/rides/" + DETAIL_RIDE_ID + "**", (route) => {
      if (route.request().url().includes("/live")) return route.continue();
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ride: {
            id: DETAIL_RIDE_ID,
            title: "Desert Dunes Blast",
            rideNumber: "#001",
            type: "day",
            status,
            startDate: new Date(Date.now() + 7 * 86_400_000).toISOString(),
            endDate: new Date(Date.now() + 7 * 86_400_000 + 28_800_000).toISOString(),
            startLocation: "Riyadh",
            endLocation: "Al Kharj",
            startLocationUrl: null,
            endLocationUrl: null,
            route: [],
            distanceKm: 180,
            maxRiders: 40,
            extraBedSlots: 0,
            extraBedFee: 0,
            registeredRiders: 12,
            activeRegistrations: 12,
            difficulty: "moderate",
            description: "A great ride",
            highlights: [],
            posterUrl: null,
            fee: 100,
            leadRider: "Ahmed",
            sweepRider: "Omar",
            organisedBy: "T2W",
            accountsBy: null,
            meetupTime: "06:00 AM",
            rideStartTime: "07:00 AM",
            startingPoint: "Parking Lot A",
            riders: [],
            regFormSettings: null,
            regOpenCore: null,
            regOpenT2w: null,
            regOpenRider: null,
            detailsVisible: false,
            participations: [],
            confirmedRiderNames: [],
            confirmedRiders: [],
            currentUserRegistered: false,
            currentUserConfirmationCode: null,
            currentUserApprovalStatus: null,
          },
        }),
      });
    });
  }

  function mockRidePosts(page: Page) {
    return page.route("**/api/ride-posts**", (route) => {
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ posts: [] }) });
    });
  }

  // Mock noisy background routes so the page settles quickly
  function mockSideRoutes(page: Page) {
    return Promise.all([
      page.route("**/api/riders**", (route) =>
        route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ riders: [] }) })
      ),
      page.route("**/api/site-settings**", (route) =>
        route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ settings: {} }) })
      ),
    ]);
  }

  async function goToDetailPage(page: Page, rideId: string) {
    await page.goto("/ride/" + rideId);
    // Wait for the mocked ride API response, not networkidle (background DB calls would stall)
    await page.waitForResponse("**/api/rides/" + rideId + "**");
  }

  test("shows 'Live Tracking' link when ride is ongoing", async ({ page }) => {
    await mockAuthAs(page, USERS.rider);
    await mockRideAs(page, "ongoing");
    await mockRidePosts(page);
    await mockSideRoutes(page);

    await goToDetailPage(page, DETAIL_RIDE_ID);

    const link = page.getByRole("link", { name: /Live Tracking/i });
    await expect(link).toBeVisible({ timeout: 10000 });
    await expect(link).toHaveAttribute("href", "/ride/" + DETAIL_RIDE_ID + "/live");
  });

  test("shows 'View Ride Map' link when ride is completed", async ({ page }) => {
    await mockAuthAs(page, USERS.rider);
    await mockRideAs(page, "completed");
    await mockRidePosts(page);
    await mockSideRoutes(page);

    await goToDetailPage(page, DETAIL_RIDE_ID);

    const link = page.getByRole("link", { name: /View Ride Map/i });
    await expect(link).toBeVisible({ timeout: 10000 });
    await expect(link).toHaveAttribute("href", "/ride/" + DETAIL_RIDE_ID + "/live");
  });

  test("no tracking link when ride is upcoming", async ({ page }) => {
    await mockAuthAs(page, USERS.rider);
    await mockRideAs(page, "upcoming");
    await mockRidePosts(page);
    await mockSideRoutes(page);

    await goToDetailPage(page, DETAIL_RIDE_ID);

    await expect(page.getByRole("link", { name: /Live Tracking/i })).not.toBeVisible();
    await expect(page.getByRole("link", { name: /View Ride Map/i })).not.toBeVisible();
  });

  test("no tracking link when ride is cancelled", async ({ page }) => {
    await mockAuthAs(page, USERS.rider);
    await mockRideAs(page, "cancelled");
    await mockRidePosts(page);
    await mockSideRoutes(page);

    await goToDetailPage(page, DETAIL_RIDE_ID);

    await expect(page.getByRole("link", { name: /Live Tracking/i })).not.toBeVisible();
    await expect(page.getByRole("link", { name: /View Ride Map/i })).not.toBeVisible();
  });
});

// ── Group 2: Live page — session status badges ────────────────────────────────

test.describe("Live page — session status display", () => {
  test("shows 'Waiting to Start' when no session exists", async ({ page }) => {
    await mockAuthAs(page, USERS.rider);
    await mockGoogleMaps(page);
    await mockLiveApi(page, null);
    await goToLivePage(page);

    await expect(page.getByText("Waiting to Start")).toBeVisible();
  });

  test("shows 'Live' badge when session is live", async ({ page }) => {
    await mockAuthAs(page, USERS.rider);
    await mockGoogleMaps(page);
    await mockLiveApi(page, MOCK_SESSION_LIVE);
    await goToLivePage(page);

    await expect(page.getByText("Live", { exact: true })).toBeVisible();
  });

  test("shows 'On Break' badge when session is paused", async ({ page }) => {
    await mockAuthAs(page, USERS.rider);
    await mockGoogleMaps(page);
    await mockLiveApi(page, MOCK_SESSION_PAUSED);
    await goToLivePage(page);

    await expect(page.getByText("On Break")).toBeVisible();
  });

  test("shows 'Back to Ride' button when session is ended", async ({ page }) => {
    await mockAuthAs(page, USERS.rider);
    await mockGoogleMaps(page);
    await mockLiveApi(page, MOCK_SESSION_ENDED);
    await goToLivePage(page);

    await expect(page.getByRole("button", { name: /Back to Ride/i })).toBeVisible();
  });

  test("shows rider count in header", async ({ page }) => {
    await mockAuthAs(page, USERS.rider);
    await mockGoogleMaps(page);
    await mockLiveApi(page, MOCK_SESSION_LIVE);
    await goToLivePage(page);

    // MOCK_RIDERS has 2 entries — header shows "2 riders on map"
    await expect(page.getByText(/2 riders on map/i)).toBeVisible();
  });
});

// ── Group 3: Admin controls — session lifecycle ───────────────────────────────

test.describe("Live page — admin controls (superadmin)", () => {
  test("shows 'Start Ride' button when no session exists", async ({ page }) => {
    await mockAuthAs(page, USERS.superAdmin);
    await mockGoogleMaps(page);
    await mockLiveApi(page, null);
    await goToLivePage(page);

    await expect(page.getByRole("button", { name: /Start Ride/i })).toBeVisible();
  });

  test("shows Pause, Call Break, End Ride when session is live", async ({ page }) => {
    await mockAuthAs(page, USERS.superAdmin);
    await mockGoogleMaps(page);
    await mockLiveApi(page, MOCK_SESSION_LIVE);
    await goToLivePage(page);

    await expect(page.getByRole("button", { name: /Pause/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Call Break/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /End Ride/i })).toBeVisible();
  });

  test("shows 'End Break / Resume' when session is paused", async ({ page }) => {
    await mockAuthAs(page, USERS.superAdmin);
    await mockGoogleMaps(page);
    await mockLiveApi(page, MOCK_SESSION_PAUSED);
    await goToLivePage(page);

    await expect(page.getByRole("button", { name: /End Break \/ Resume/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /End Ride/i })).toBeVisible();
  });

  test("End Ride shows confirmation dialog", async ({ page }) => {
    await mockAuthAs(page, USERS.superAdmin);
    await mockGoogleMaps(page);
    await mockLiveApi(page, MOCK_SESSION_LIVE);
    await goToLivePage(page);

    await page.getByRole("button", { name: /End Ride/i }).click();
    await expect(page.getByText("End ride?")).toBeVisible();
    await expect(page.getByRole("button", { name: /Yes, End/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Cancel/i })).toBeVisible();
  });

  test("cancelling End Ride dialog restores End Ride button", async ({ page }) => {
    await mockAuthAs(page, USERS.superAdmin);
    await mockGoogleMaps(page);
    await mockLiveApi(page, MOCK_SESSION_LIVE);
    await goToLivePage(page);

    await page.getByRole("button", { name: /End Ride/i }).click();
    await expect(page.getByText("End ride?")).toBeVisible();

    await page.getByRole("button", { name: /Cancel/i }).click();
    await expect(page.getByText("End ride?")).not.toBeVisible();
    await expect(page.getByRole("button", { name: /End Ride/i })).toBeVisible();
  });

  test("Call Break shows reason input with Start and Cancel", async ({ page }) => {
    await mockAuthAs(page, USERS.superAdmin);
    await mockGoogleMaps(page);
    await mockLiveApi(page, MOCK_SESSION_LIVE);
    await goToLivePage(page);

    await page.getByRole("button", { name: /Call Break/i }).click();
    await expect(page.getByPlaceholder(/Break reason/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /^Start$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Cancel$/i })).toBeVisible();
  });

  test("admin controls are NOT shown when session is ended", async ({ page }) => {
    await mockAuthAs(page, USERS.superAdmin);
    await mockGoogleMaps(page);
    await mockLiveApi(page, MOCK_SESSION_ENDED);
    await goToLivePage(page);

    // Post-ride view: no admin control buttons
    await expect(page.getByRole("button", { name: /Pause/i })).not.toBeVisible();
    await expect(page.getByRole("button", { name: /End Ride/i })).not.toBeVisible();
  });
});

// ── Group 4: Non-admin users do not see admin controls ────────────────────────

test.describe("Live page — rider does not see admin controls", () => {
  test("regular rider has no Start Ride button", async ({ page }) => {
    await mockAuthAs(page, USERS.rider);
    await mockGoogleMaps(page);
    await mockLiveApi(page, null);
    await goToLivePage(page);

    await expect(page.getByRole("button", { name: /Start Ride/i })).not.toBeVisible();
  });

  test("regular rider has no Pause or End Ride button during live session", async ({ page }) => {
    await mockAuthAs(page, USERS.rider);
    await mockGoogleMaps(page);
    await mockLiveApi(page, MOCK_SESSION_LIVE);
    await goToLivePage(page);

    await expect(page.getByRole("button", { name: /Pause/i })).not.toBeVisible();
    await expect(page.getByRole("button", { name: /End Ride/i })).not.toBeVisible();
  });

  test("t2w_rider has no admin controls", async ({ page }) => {
    await mockAuthAs(page, USERS.t2wRider);
    await mockGoogleMaps(page);
    await mockLiveApi(page, MOCK_SESSION_LIVE);
    await goToLivePage(page);

    await expect(page.getByRole("button", { name: /Pause/i })).not.toBeVisible();
    await expect(page.getByRole("button", { name: /Call Break/i })).not.toBeVisible();
  });
});

// ── Group 5: Rider join and tracking controls ─────────────────────────────────

test.describe("Live page — rider join and tracking controls", () => {
  test("shows 'Join Ride' when session is live", async ({ page }) => {
    await mockAuthAs(page, USERS.rider);
    await mockGoogleMaps(page);
    await mockLiveApi(page, MOCK_SESSION_LIVE);
    await goToLivePage(page);

    await expect(page.getByRole("button", { name: /Join Ride/i })).toBeVisible();
  });

  test("no 'Join Ride' when session is ended", async ({ page }) => {
    await mockAuthAs(page, USERS.rider);
    await mockGoogleMaps(page);
    await mockLiveApi(page, MOCK_SESSION_ENDED);
    await goToLivePage(page);

    await expect(page.getByRole("button", { name: /Join Ride/i })).not.toBeVisible();
  });

  test("no 'Join Ride' when no session exists", async ({ page }) => {
    await mockAuthAs(page, USERS.rider);
    await mockGoogleMaps(page);
    await mockLiveApi(page, null);
    await goToLivePage(page);

    await expect(page.getByRole("button", { name: /Join Ride/i })).not.toBeVisible();
  });

  test("'Join Ride' visible during paused session", async ({ page }) => {
    await mockAuthAs(page, USERS.rider);
    await mockGoogleMaps(page);
    await mockLiveApi(page, MOCK_SESSION_PAUSED);
    await goToLivePage(page);

    await expect(page.getByRole("button", { name: /Join Ride/i })).toBeVisible();
  });

  test("after joining, shows tracking toggle button", async ({ page }) => {
    await mockAuthAs(page, USERS.rider);
    await mockGoogleMaps(page);
    await mockLiveApi(page, MOCK_SESSION_LIVE);
    await goToLivePage(page);

    await page.getByRole("button", { name: /Join Ride/i }).click();

    // After joining, "Start Tracking" or "Stop Tracking" toggle should appear
    await expect(
      page.getByRole("button", { name: /Start Tracking|Stop Tracking/i })
    ).toBeVisible({ timeout: 5000 });
  });
});

// ── Group 6: GPS Active badge ─────────────────────────────────────────────────

test.describe("Live page — GPS Active badge", () => {
  test("GPS Active badge not shown before joining", async ({ page }) => {
    await mockAuthAs(page, USERS.rider);
    await mockGoogleMaps(page);
    await mockLiveApi(page, MOCK_SESSION_LIVE);
    await goToLivePage(page);

    await expect(page.getByText("GPS Active")).not.toBeVisible();
  });
});

// ── Group 7: API authentication & authorisation (real server) ─────────────────

test.describe("Live API — authentication and authorisation", () => {
  test("GET /live returns 401 without auth", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const status = await page.evaluate(async (url) => {
      const r = await fetch(url);
      return r.status;
    }, BASE_URL + "/api/rides/fake-ride-id/live");

    expect(status).toBe(401);
  });

  test("POST /live returns 401 or 403 without valid session", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const status = await page.evaluate(async (url) => {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      return r.status;
    }, BASE_URL + "/api/rides/fake-ride-id/live");

    expect([401, 403]).toContain(status);
  });

  test("POST /live/join returns 401 without auth", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const status = await page.evaluate(async (url) => {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      return r.status;
    }, BASE_URL + "/api/rides/fake-ride-id/live/join");

    expect(status).toBe(401);
  });

  test("POST /live/location returns 401 without auth", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const status = await page.evaluate(async (url) => {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: 24.7, lng: 46.7 }),
      });
      return r.status;
    }, BASE_URL + "/api/rides/fake-ride-id/live/location");

    expect(status).toBe(401);
  });

  test("GET /live/metrics returns 401 without auth", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const status = await page.evaluate(async (url) => {
      const r = await fetch(url);
      return r.status;
    }, BASE_URL + "/api/rides/fake-ride-id/live/metrics");

    expect(status).toBe(401);
  });

  test("POST /live/break returns 401 or 403 without auth", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const status = await page.evaluate(async (url) => {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      return r.status;
    }, BASE_URL + "/api/rides/fake-ride-id/live/break");

    expect([401, 403, 429]).toContain(status);
  });
});

// ── Group 8: API mocked behaviour ────────────────────────────────────────────

test.describe("Live API — mocked response shapes", () => {
  test("Start Ride button POSTs action:start to session endpoint", async ({ page }) => {
    await mockAuthAs(page, USERS.superAdmin);
    await mockGoogleMaps(page);

    // Register general live API first (lower priority)
    const liveBase = "/api/rides/" + RIDE_ID + "/live";
    await page.route("**" + liveBase + "/metrics**", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_METRICS) })
    );

    let capturedBody: Record<string, unknown> | null = null;
    await page.route("**" + liveBase + "**", (route) => {
      const url = route.request().url();
      if (url.includes("/metrics") || url.includes("/join") || url.includes("/location") || url.includes("/break")) {
        return route.continue();
      }
      if (route.request().method() === "POST") {
        capturedBody = JSON.parse(route.request().postData() || "{}") as Record<string, unknown>;
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ session: MOCK_SESSION_LIVE, action: "started" }),
        });
      }
      // GET — return no session so Start Ride button appears
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ session: null, riders: [], leadPath: [] }),
      });
    });

    await goToLivePage(page);
    await page.getByRole("button", { name: /Start Ride/i }).click();
    await page.waitForTimeout(500);

    expect(capturedBody).toMatchObject({ action: "start" });
  });

  test("Call Break POSTs with action:start and reason", async ({ page }) => {
    await mockAuthAs(page, USERS.superAdmin);
    await mockGoogleMaps(page);
    await mockLiveApi(page, MOCK_SESSION_LIVE);

    let capturedBreakBody: Record<string, unknown> | null = null;
    await page.route("**" + "/api/rides/" + RIDE_ID + "/live/break**", (route) => {
      capturedBreakBody = JSON.parse(route.request().postData() || "{}") as Record<string, unknown>;
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          break: { id: "b1", sessionId: "s1", startedAt: new Date().toISOString(), endedAt: null },
        }),
      });
    });

    await goToLivePage(page);
    await page.getByRole("button", { name: /Call Break/i }).click();
    await page.getByPlaceholder(/Break reason/i).fill("Fuel stop");
    await page.getByRole("button", { name: /^Start$/i }).click();
    await page.waitForTimeout(300);

    expect(capturedBreakBody).toMatchObject({ action: "start", reason: "Fuel stop" });
  });

  test("Call Break without reason sends action:start without reason field", async ({ page }) => {
    await mockAuthAs(page, USERS.superAdmin);
    await mockGoogleMaps(page);
    await mockLiveApi(page, MOCK_SESSION_LIVE);

    let capturedBreakBody: Record<string, unknown> | null = null;
    await page.route("**" + "/api/rides/" + RIDE_ID + "/live/break**", (route) => {
      capturedBreakBody = JSON.parse(route.request().postData() || "{}") as Record<string, unknown>;
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          break: { id: "b1", sessionId: "s1", startedAt: new Date().toISOString(), endedAt: null },
        }),
      });
    });

    await goToLivePage(page);
    await page.getByRole("button", { name: /Call Break/i }).click();
    await page.getByRole("button", { name: /^Start$/i }).click();
    await page.waitForTimeout(300);

    expect(capturedBreakBody).toMatchObject({ action: "start" });
    expect(capturedBreakBody?.reason).toBeUndefined();
  });

  test("duplicate break start returns 400 (mocked)", async ({ page }) => {
    let callCount = 0;
    await page.route("**" + "/api/rides/" + RIDE_ID + "/live/break**", (route) => {
      callCount++;
      if (callCount === 1) {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            break: { id: "b1", sessionId: "s1", startedAt: new Date().toISOString() },
          }),
        });
      } else {
        route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({ error: "A break is already active" }),
        });
      }
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const r1 = await page.evaluate(async (url) => {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      return { status: r.status, body: await r.json() };
    }, BASE_URL + "/api/rides/" + RIDE_ID + "/live/break");
    expect(r1.status).toBe(200);

    const r2 = await page.evaluate(async (url) => {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      return { status: r.status, body: await r.json() };
    }, BASE_URL + "/api/rides/" + RIDE_ID + "/live/break");
    expect(r2.status).toBe(400);
    expect(r2.body.error).toBe("A break is already active");
  });

  test("location submission sends correct lat/lng payload", async ({ page }) => {
    let capturedLocationBody: Record<string, unknown> | null = null;
    await page.route("**" + "/api/rides/" + RIDE_ID + "/live/location**", (route) => {
      capturedLocationBody = JSON.parse(route.request().postData() || "{}") as Record<string, unknown>;
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, isDeviated: false }),
      });
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await page.evaluate(async (url) => {
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: 24.77, lng: 46.72, speed: 65, heading: 90 }),
      });
    }, BASE_URL + "/api/rides/" + RIDE_ID + "/live/location");

    expect(capturedLocationBody).toMatchObject({ lat: 24.77, lng: 46.72 });
  });

  test("metrics GET returns expected fields", async ({ page }) => {
    await page.route("**" + "/api/rides/" + RIDE_ID + "/live/metrics**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_METRICS),
      });
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const data = await page.evaluate(async (url) => {
      const r = await fetch(url);
      return r.json();
    }, BASE_URL + "/api/rides/" + RIDE_ID + "/live/metrics");

    expect(data).toMatchObject({
      elapsedMinutes: expect.any(Number),
      distanceKm: expect.any(Number),
      avgSpeedKmh: expect.any(Number),
      maxSpeedKmh: expect.any(Number),
      riderCount: expect.any(Number),
    });
  });
});
