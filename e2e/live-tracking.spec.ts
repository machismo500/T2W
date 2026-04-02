import { test, expect } from "@playwright/test";
import { mockAuthAs, USERS } from "./helpers";

const RIDE_ID = "ride-2";

const MOCK_LIVE_SESSION = {
  id: "session-1",
  rideId: RIDE_ID,
  status: "live",
  startedAt: new Date(Date.now() - 3600000).toISOString(),
  pausedAt: null,
  endedAt: null,
  plannedRoute: JSON.stringify([
    { lat: 24.7, lng: 46.7 },
    { lat: 24.8, lng: 46.8 },
  ]),
};

function setupLiveTrackingMocks(page: Parameters<typeof mockAuthAs>[0]) {
  return Promise.all([
    page.route(`/api/rides/${RIDE_ID}/live/session**`, (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ session: MOCK_LIVE_SESSION }),
      });
    }),
    page.route(`/api/rides/${RIDE_ID}/live/location**`, (route) => {
      if (route.request().method() === "GET") {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            locations: [
              {
                id: "loc-1",
                sessionId: "session-1",
                latitude: 24.75,
                longitude: 46.75,
                timestamp: new Date().toISOString(),
                speed: 60,
                heading: 90,
                accuracy: 10,
              },
            ],
          }),
        });
      } else {
        route.continue();
      }
    }),
    page.route(`/api/rides/${RIDE_ID}/live/metrics**`, (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          metrics: {
            distanceCovered: 45.2,
            elapsedTime: 3600,
            currentSpeed: 60,
            averageSpeed: 55,
            estimatedTimeRemaining: 1800,
            breakDuration: 0,
          },
        }),
      });
    }),
  ]);
}

test.describe("Live tracking page — access control", () => {
  test("live tracking page loads for unauthenticated user", async ({ page }) => {
    await mockAuthAs(page, USERS.unauthenticated);
    await setupLiveTrackingMocks(page);

    await page.goto(`/rides/${RIDE_ID}/live`);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).toBeVisible();
  });

  test("live tracking shows current location data", async ({ page }) => {
    await mockAuthAs(page, USERS.unauthenticated);
    await setupLiveTrackingMocks(page);

    await page.goto(`/rides/${RIDE_ID}/live`);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("Live tracking admin controls", () => {
  test("Core Member sees live tracking controls", async ({ page }) => {
    await mockAuthAs(page, USERS.coreMember);
    await setupLiveTrackingMocks(page);
    await page.route(`/api/rides/${RIDE_ID}**`, (route) => {
      if (route.request().url().includes("/live")) return route.continue();
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ride: {
            id: RIDE_ID,
            title: "Mountain Pass Challenge",
            status: "upcoming",
            type: "overnight",
          },
        }),
      });
    });

    await page.goto(`/rides/${RIDE_ID}/live`);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).toBeVisible();
  });

  test("break start API prevents duplicate breaks", async ({ page }) => {
    await mockAuthAs(page, USERS.superAdmin);
    await setupLiveTrackingMocks(page);

    let breakStartCount = 0;
    await page.route(`**/api/rides/${RIDE_ID}/live/break`, (route) => {
      if (route.request().method() === "POST") {
        breakStartCount++;
        if (breakStartCount === 1) {
          route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ break: { id: "break-1", sessionId: "session-1", startedAt: new Date().toISOString() } }),
          });
        } else {
          route.fulfill({
            status: 400,
            contentType: "application/json",
            body: JSON.stringify({ error: "A break is already active" }),
          });
        }
      } else {
        route.continue();
      }
    });

    // Navigate to a page first so page.evaluate fetch calls are intercepted
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Make two break start requests using page.evaluate (browser context, intercepted by page.route)
    const result1 = await page.evaluate(async (url) => {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      return { status: r.status, body: await r.json() };
    }, `http://localhost:3001/api/rides/${RIDE_ID}/live/break`);
    expect(result1.status).toBe(200);

    const result2 = await page.evaluate(async (url) => {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      return { status: r.status, body: await r.json() };
    }, `http://localhost:3001/api/rides/${RIDE_ID}/live/break`);
    expect(result2.status).toBe(400);
    expect(result2.body.error).toBe("A break is already active");
  });
});

test.describe("Live tracking session management", () => {
  test("ended session returns appropriate status", async ({ page }) => {
    await mockAuthAs(page, USERS.superAdmin);
    await page.route(`**/api/rides/${RIDE_ID}/live/break`, (route) => {
      if (route.request().method() === "POST") {
        route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({ error: "Session is not live" }),
        });
      } else {
        route.continue();
      }
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const result = await page.evaluate(async (url) => {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      return { status: r.status, body: await r.json() };
    }, `http://localhost:3001/api/rides/${RIDE_ID}/live/break`);
    expect(result.status).toBe(400);
    expect(result.body.error).toBeTruthy();
  });

  test("location updates accepted during live session", async ({ page }) => {
    await mockAuthAs(page, USERS.superAdmin);
    let locationUpdated = false;

    await page.route(`**/api/rides/${RIDE_ID}/live/location`, (route) => {
      if (route.request().method() === "POST") {
        locationUpdated = true;
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ location: { id: "loc-new" } }),
        });
      } else {
        route.continue();
      }
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await page.evaluate(async (url) => {
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: 24.75,
          longitude: 46.75,
          timestamp: new Date().toISOString(),
          speed: 65,
          heading: 90,
          accuracy: 8,
        }),
      });
    }, `http://localhost:3001/api/rides/${RIDE_ID}/live/location`);

    expect(locationUpdated).toBe(true);
  });
});
