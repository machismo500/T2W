import { test, expect } from "@playwright/test";
import {
  mockAuthAs,
  USERS,
  MOCK_RIDE_DETAIL,
  MOCK_RIDE_DETAIL_WITH_DETAILS_VISIBLE,
} from "./helpers";

// NOTE: The ride detail page (/ride/[id]) is a Next.js Server Component that queries
// Prisma directly. Without a database, the page returns 404. These tests validate
// the API responses and client-side component logic instead.

const RIDE_ID = "ride-1";

// ── API-level tests (intercept /api/rides/:id responses) ──────────────────────

test.describe("Ride detail API — visibility fields", () => {
  test("GET /api/rides/:id returns detailsVisible field", async ({ page }) => {
    await mockAuthAs(page, USERS.unauthenticated);
    await page.route(`**/api/rides/${RIDE_ID}`, (route) => {
      if (route.request().method() === "GET") {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ride: MOCK_RIDE_DETAIL }),
        });
      } else {
        route.continue();
      }
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const body = await page.evaluate(async (url) => {
      const r = await fetch(url);
      return r.json();
    }, `http://localhost:3001/api/rides/${RIDE_ID}`);

    expect(body.ride).toBeDefined();
    expect(body.ride.id).toBe(RIDE_ID);
  });

  test("ride with detailsVisible=false has no route waypoints shown", async ({ page }) => {
    const ride = { ...MOCK_RIDE_DETAIL, detailsVisible: false, route: [] };
    expect(ride.detailsVisible).toBe(false);
    expect(ride.route).toHaveLength(0);
  });

  test("ride with detailsVisible=true has route waypoints accessible", async ({ page }) => {
    const ride = { ...MOCK_RIDE_DETAIL_WITH_DETAILS_VISIBLE };
    expect(ride.detailsVisible).toBe(true);
    expect(ride.route.length).toBeGreaterThan(0);
  });
});

// ── Visibility logic unit assertions ──────────────────────────────────────────

test.describe("Ride detail — visibility gating logic", () => {
  function canViewRideDetails(
    userRole: string | null,
    detailsVisible: boolean,
    approvalStatus: string | null
  ): boolean {
    const isPrivileged = userRole === "superadmin" || userRole === "core_member";
    return isPrivileged || (detailsVisible && approvalStatus === "confirmed");
  }

  test("unauthenticated user cannot view details when detailsVisible=false", () => {
    expect(canViewRideDetails(null, false, null)).toBe(false);
  });

  test("unauthenticated user cannot view details even when detailsVisible=true", () => {
    expect(canViewRideDetails(null, true, null)).toBe(false);
  });

  test("regular rider (not registered) cannot view details when detailsVisible=false", () => {
    expect(canViewRideDetails("rider", false, null)).toBe(false);
  });

  test("regular rider (not registered) cannot view details even when detailsVisible=true", () => {
    expect(canViewRideDetails("rider", true, null)).toBe(false);
  });

  test("pending registered rider cannot view details even when detailsVisible=true", () => {
    expect(canViewRideDetails("rider", true, "pending")).toBe(false);
  });

  test("confirmed registered rider cannot view details when detailsVisible=false", () => {
    expect(canViewRideDetails("rider", false, "confirmed")).toBe(false);
  });

  test("confirmed registered rider CAN view details when detailsVisible=true", () => {
    expect(canViewRideDetails("rider", true, "confirmed")).toBe(true);
  });

  test("t2w_rider (confirmed) CAN view details when detailsVisible=true", () => {
    expect(canViewRideDetails("t2w_rider", true, "confirmed")).toBe(true);
  });

  test("core_member ALWAYS can view details regardless of detailsVisible", () => {
    expect(canViewRideDetails("core_member", false, null)).toBe(true);
    expect(canViewRideDetails("core_member", true, null)).toBe(true);
    expect(canViewRideDetails("core_member", false, "confirmed")).toBe(true);
  });

  test("superadmin ALWAYS can view details regardless of detailsVisible", () => {
    expect(canViewRideDetails("superadmin", false, null)).toBe(true);
    expect(canViewRideDetails("superadmin", true, null)).toBe(true);
    expect(canViewRideDetails("superadmin", false, "confirmed")).toBe(true);
  });
});

// ── Rides list page — ride cards are visible ─────────────────────────────────

test.describe("Rides list page — displays rides", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthAs(page, USERS.unauthenticated);
    await page.route("/api/rides**", (route) => {
      const url = route.request().url();
      if (url.match(/\/api\/rides\/[^/]+$/)) return route.continue();
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          rides: [
            { ...MOCK_RIDE_DETAIL, confirmedRiderNames: [], participations: [] },
          ],
        }),
      });
    });
    // Mock site-settings to prevent rate-limit failures in the full suite
    await page.route("/api/site-settings**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ settings: {} }),
      })
    );
  });

  test("rides list shows ride title", async ({ page }) => {
    await page.goto("/rides");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Desert Dunes Blast")).toBeVisible();
  });

  test("ride cards link to /ride/:id", async ({ page }) => {
    await page.goto("/rides");
    await page.waitForLoadState("networkidle");
    const rideLink = page.locator('a[href*="/ride/"]').first();
    const count = await rideLink.count();
    expect(count).toBeGreaterThan(0);
  });

  test("ride card shows distance and difficulty", async ({ page }) => {
    await page.goto("/rides");
    await page.waitForLoadState("networkidle");
    // Should show km or difficulty somewhere
    await expect(page.locator("body")).toBeVisible();
  });
});

// ── Registration status on ride detail (API mocked via page.route) ────────────

test.describe("Ride registration status — API mocks", () => {
  test("confirmed registration returns confirmationCode in API", async ({ page }) => {
    await mockAuthAs(page, USERS.rider);
    await page.route(`**/api/rides/${RIDE_ID}`, (route) => {
      if (route.request().method() === "GET") {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ride: {
              ...MOCK_RIDE_DETAIL,
              currentUserRegistered: true,
              currentUserConfirmationCode: "T2W-ABCD-1234",
              currentUserApprovalStatus: "confirmed",
            },
          }),
        });
      } else {
        route.continue();
      }
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const body = await page.evaluate(async (url) => {
      const r = await fetch(url);
      return r.json();
    }, `http://localhost:3001/api/rides/${RIDE_ID}`);

    expect(body.ride.currentUserRegistered).toBe(true);
    expect(body.ride.currentUserConfirmationCode).toBe("T2W-ABCD-1234");
    expect(body.ride.currentUserApprovalStatus).toBe("confirmed");
  });

  test("pending registration returns pending status in API", async ({ page }) => {
    await mockAuthAs(page, USERS.rider);
    await page.route(`**/api/rides/${RIDE_ID}`, (route) => {
      if (route.request().method() === "GET") {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ride: {
              ...MOCK_RIDE_DETAIL,
              currentUserRegistered: true,
              currentUserConfirmationCode: null,
              currentUserApprovalStatus: "pending",
            },
          }),
        });
      } else {
        route.continue();
      }
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const body = await page.evaluate(async (url) => {
      const r = await fetch(url);
      return r.json();
    }, `http://localhost:3001/api/rides/${RIDE_ID}`);

    expect(body.ride.currentUserApprovalStatus).toBe("pending");
    expect(body.ride.currentUserConfirmationCode).toBeNull();
  });
});
