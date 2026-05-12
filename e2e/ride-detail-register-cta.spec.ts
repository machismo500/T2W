import { test, expect, type Page, type Route } from "@playwright/test";
import { mockAuthAs, USERS, MOCK_RIDE_DETAIL } from "./helpers";

// Catches the second bug the user found manually: the ride detail page kept
// showing "Register Now" even after they had registered. The existing
// registration.spec.ts only verified the API response shape — it never
// visited the detail page and asserted on the rendered button. This file
// fills that gap.

const RIDE_ID = "ride-detail-reg-test";

async function mockDetail(
  page: Page,
  overrides: Record<string, unknown>
) {
  // /api/rides/:id — the detail payload, with currentUser* fields driven
  // by the test arg.
  await page.route(`**/api/rides/${RIDE_ID}**`, (route: Route) => {
    if (route.request().method() !== "GET") return route.continue();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ride: {
          ...MOCK_RIDE_DETAIL,
          id: RIDE_ID,
          rideNumber: "#001",
          status: "upcoming",
          startDate: new Date(Date.now() + 7 * 86400000).toISOString(),
          endDate: new Date(Date.now() + 7 * 86400000 + 28800000).toISOString(),
          maxRiders: 25,
          activeRegistrations: 10,
          regFormSettings: { fields: [] },
          regOpenRider: new Date(Date.now() - 86400000).toISOString(),
          ...overrides,
        },
      }),
    });
  });
  // Adjacent endpoints called by the detail page on mount — empty mocks
  // so the page doesn't hang waiting on real backends.
  await page.route("**/api/ride-posts**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{\"posts\":[]}" })
  );
  await page.route("**/api/motorcycles**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{\"motorcycles\":[]}" })
  );
  await page.route("**/api/admin/registration-form-settings**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{\"fields\":[]}" })
  );
}

test.describe("Ride detail — Register Now visibility reflects currentUserRegistered", () => {
  test("hides the Register Now button when the user is already registered (confirmed)", async ({ page }) => {
    await mockAuthAs(page, USERS.rider);
    await mockDetail(page, {
      currentUserRegistered: true,
      currentUserApprovalStatus: "confirmed",
      currentUserConfirmationCode: "T2W-AAAA-0001",
      currentUserDroppedOut: false,
    });

    await page.goto(`/ride/${RIDE_ID}`);
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("button", { name: /Register Now/i })).toHaveCount(0);
    // The "Register for this Ride" card heading should also be gone.
    await expect(page.getByRole("heading", { name: /Register for this Ride/i })).toHaveCount(0);
  });

  test("hides Register Now when pending (not yet approved but already submitted)", async ({ page }) => {
    await mockAuthAs(page, USERS.rider);
    await mockDetail(page, {
      currentUserRegistered: true,
      currentUserApprovalStatus: "pending",
      currentUserConfirmationCode: null,
      currentUserDroppedOut: false,
    });

    await page.goto(`/ride/${RIDE_ID}`);
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("button", { name: /Register Now/i })).toHaveCount(0);
  });

  test("shows Register Now when the user has not registered", async ({ page }) => {
    await mockAuthAs(page, USERS.rider);
    await mockDetail(page, {
      currentUserRegistered: false,
      currentUserApprovalStatus: null,
      currentUserDroppedOut: false,
    });

    await page.goto(`/ride/${RIDE_ID}`);
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("button", { name: /Register Now/i })).toBeVisible();
  });

  test("shows Register Now again when the user was dropped out by an admin", async ({ page }) => {
    await mockAuthAs(page, USERS.rider);
    await mockDetail(page, {
      // Server logic: a dropped-out rider sees currentUserRegistered=false
      // even if a RideRegistration row still exists, so the detail page
      // surfaces Register Now with the "You were marked as dropped-out"
      // banner.
      currentUserRegistered: false,
      currentUserApprovalStatus: null,
      currentUserDroppedOut: true,
    });

    await page.goto(`/ride/${RIDE_ID}`);
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("button", { name: /Register Now/i })).toBeVisible();
    await expect(page.getByText(/marked as dropped-out/i)).toBeVisible();
  });
});
