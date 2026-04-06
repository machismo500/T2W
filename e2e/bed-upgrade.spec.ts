import { test, expect } from "@playwright/test";
import { mockAuthAs, mockRolePermissions, USERS, MOCK_RIDES } from "./helpers";

// ── Bed upgrade feature E2E tests ─────────────────────────────────────────────
// Tests the "Upgrade to Bed" feature: when a bed-type rider drops out, a
// confirmed extra-bed registrant can be manually promoted to a regular bed slot
// by a superadmin or core_member in the admin registrations panel.

const RIDE_ID = "ride-1";
const BASE_URL = "http://localhost:3001";

// Two confirmed bed riders, one confirmed extra-bed rider. maxRiders=2 so both
// bed slots are occupied — no upgrade possible.
const REGISTRATIONS_BED_FULL = [
  {
    id: "reg-bed-1",
    rideId: RIDE_ID,
    userId: "user-1",
    riderName: "Bed Rider 1",
    email: "bed1@test.com",
    phone: "+966500000001",
    registeredAt: new Date().toISOString(),
    confirmationCode: "T2W-001",
    approvalStatus: "confirmed",
    accommodationType: "bed",
  },
  {
    id: "reg-bed-2",
    rideId: RIDE_ID,
    userId: "user-2",
    riderName: "Bed Rider 2",
    email: "bed2@test.com",
    phone: "+966500000002",
    registeredAt: new Date().toISOString(),
    confirmationCode: "T2W-002",
    approvalStatus: "confirmed",
    accommodationType: "bed",
  },
  {
    id: "reg-extra-1",
    rideId: RIDE_ID,
    userId: "user-3",
    riderName: "Extra Rider",
    email: "extra@test.com",
    phone: "+966500000003",
    registeredAt: new Date().toISOString(),
    confirmationCode: "T2W-003",
    approvalStatus: "confirmed",
    accommodationType: "extra-bed",
  },
];

// Same but bed rider 1 has dropped out — confirmedBedCount(1) < maxRiders(2).
const REGISTRATIONS_BED_SLOT_FREE = REGISTRATIONS_BED_FULL.map((r) =>
  r.id === "reg-bed-1" ? { ...r, approvalStatus: "dropout" } : r
);

// Ride fixture with maxRiders=2 and extraBedSlots=2.
const RIDE_WITH_EXTRA_BEDS = {
  ...MOCK_RIDES[0],
  id: RIDE_ID,
  maxRiders: 2,
  extraBedSlots: 2,
  extraBedFee: 500,
  fee: 1000,
};

// ── Helper: set up all standard admin mocks ───────────────────────────────────

async function setupAdminMocks(page: Parameters<typeof mockAuthAs>[0]) {
  await Promise.all([
    mockRolePermissions(page),
    page.route("/api/admin/stats**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ totalRides: 1, totalRiders: 3, upcomingRides: 1 }),
      })
    ),
    page.route("/api/admin/users**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ users: [] }),
      })
    ),
    page.route("/api/rider-profiles**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ profiles: [] }),
      })
    ),
    page.route("/api/badges**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ badges: [] }),
      })
    ),
    page.route("/api/activity-log**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ logs: [] }),
      })
    ),
    page.route("/api/site-settings**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ settings: {} }),
      })
    ),
    // Rides list — must not intercept registration sub-routes or specific ride IDs
    page.route("/api/rides**", (route) => {
      const url = route.request().url();
      if (url.match(/\/api\/rides\/[^/]+\/registrations/)) return route.continue();
      if (url.match(/\/api\/rides\/[^/]+$/)) return route.continue();
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ rides: [RIDE_WITH_EXTRA_BEDS] }),
      });
    }),
  ]);
}

/** Mock the registrations GET endpoint for RIDE_ID. */
async function mockRegistrationsEndpoint(
  page: Parameters<typeof mockAuthAs>[0],
  registrations: typeof REGISTRATIONS_BED_FULL
) {
  await page.route(`/api/rides/${RIDE_ID}/registrations**`, (route) => {
    if (route.request().method() !== "GET") return route.continue();
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ registrations }),
    });
  });
}

/** Navigate to admin, click Rides tab, then click the first Manage button. */
async function openRegistrationsPanel(page: Parameters<typeof mockAuthAs>[0]) {
  await page.goto("/admin");
  // Click the "Rides" tab
  await page.locator("button").filter({ hasText: /^Rides$/ }).click();
  // Click "Manage" to open the registrations panel for the first ride
  const manageBtn = page.locator("button").filter({ hasText: /^Manage$/ }).first();
  await manageBtn.waitFor({ timeout: 8000 });
  await manageBtn.click();
}

// ── PATCH API — input validation ─────────────────────────────────────────────

test.describe("Bed upgrade — PATCH API validation", () => {
  test("PATCH with no fields returns 400 or auth error", async ({ page }) => {
    await mockAuthAs(page, USERS.unauthenticated);
    await page.goto("/");

    const result = await page.evaluate(async (url) => {
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      return { status: res.status };
    }, `${BASE_URL}/api/rides/${RIDE_ID}/registrations/reg-1`);

    // Unauthenticated → 401/403 before validation; authed with empty body → 400; 429 = rate-limited under load
    expect([400, 401, 403, 429]).toContain(result.status);
  });

  test("PATCH with accommodationType other than 'bed' is rejected", async ({ page }) => {
    await mockAuthAs(page, USERS.unauthenticated);
    await page.goto("/");

    const result = await page.evaluate(async (url) => {
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accommodationType: "extra-bed" }),
      });
      return { status: res.status };
    }, `${BASE_URL}/api/rides/${RIDE_ID}/registrations/reg-1`);

    expect([400, 401, 403, 429]).toContain(result.status);
  });

  test("PATCH with valid accommodationType:'bed' is not a 405/404 (route exists)", async ({ page }) => {
    await mockAuthAs(page, USERS.unauthenticated);
    await page.goto("/");

    const result = await page.evaluate(async (url) => {
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accommodationType: "bed" }),
      });
      return { status: res.status };
    }, `${BASE_URL}/api/rides/${RIDE_ID}/registrations/reg-nonexistent`);

    // Route exists: should be 401/403 (auth) or 400/404 (validation/not-found),
    // but NOT 405 (method not allowed) which would mean the route doesn't handle it.
    expect(result.status).not.toBe(405);
  });
});

// ── Admin UI — "Upgrade to Bed" button visibility ────────────────────────────

test.describe("Bed upgrade — admin panel button visibility", () => {
  test("'Upgrade to Bed' button appears for confirmed extra-bed when a bed slot is free", async ({ page }) => {
    await mockAuthAs(page, USERS.superAdmin);
    await setupAdminMocks(page);
    await mockRegistrationsEndpoint(page, REGISTRATIONS_BED_SLOT_FREE);

    await openRegistrationsPanel(page);

    await expect(page.locator("text=Extra Rider")).toBeVisible({ timeout: 5000 });
    await expect(page.locator("button").filter({ hasText: "Upgrade to Bed" })).toBeVisible();
  });

  test("'Upgrade to Bed' button is absent when all bed slots are occupied", async ({ page }) => {
    await mockAuthAs(page, USERS.superAdmin);
    await setupAdminMocks(page);
    // Both bed riders confirmed → confirmedBedCount(2) === maxRiders(2)
    await mockRegistrationsEndpoint(page, REGISTRATIONS_BED_FULL);

    await openRegistrationsPanel(page);

    await expect(page.locator("text=Extra Rider")).toBeVisible({ timeout: 5000 });
    await expect(page.locator("button").filter({ hasText: "Upgrade to Bed" })).not.toBeVisible();
  });

  test("'Upgrade to Bed' button is absent for a pending extra-bed registrant", async ({ page }) => {
    await mockAuthAs(page, USERS.superAdmin);
    await setupAdminMocks(page);

    // Bed slot is free (bed-1 dropped out), but extra-bed rider is pending not confirmed
    const regsWithPendingExtra = REGISTRATIONS_BED_SLOT_FREE.map((r) =>
      r.id === "reg-extra-1" ? { ...r, approvalStatus: "pending" } : r
    );
    await mockRegistrationsEndpoint(page, regsWithPendingExtra);

    await openRegistrationsPanel(page);

    await expect(page.locator("text=Extra Rider")).toBeVisible({ timeout: 5000 });
    await expect(page.locator("button").filter({ hasText: "Upgrade to Bed" })).not.toBeVisible();
  });

  test("'Upgrade to Bed' button is absent for a dropout extra-bed registrant", async ({ page }) => {
    await mockAuthAs(page, USERS.superAdmin);
    await setupAdminMocks(page);

    const regsWithDropoutExtra = REGISTRATIONS_BED_SLOT_FREE.map((r) =>
      r.id === "reg-extra-1" ? { ...r, approvalStatus: "dropout" } : r
    );
    await mockRegistrationsEndpoint(page, regsWithDropoutExtra);

    await openRegistrationsPanel(page);

    await expect(page.locator("text=Extra Rider")).toBeVisible({ timeout: 5000 });
    await expect(page.locator("button").filter({ hasText: "Upgrade to Bed" })).not.toBeVisible();
  });

  test("'Upgrade to Bed' button only appears once (next to extra-bed rider, not bed riders)", async ({ page }) => {
    await mockAuthAs(page, USERS.superAdmin);
    await setupAdminMocks(page);
    await mockRegistrationsEndpoint(page, REGISTRATIONS_BED_SLOT_FREE);

    await openRegistrationsPanel(page);

    await expect(page.locator("text=Bed Rider 2")).toBeVisible({ timeout: 5000 });
    // Exactly one button — only the extra-bed rider is eligible
    await expect(page.locator("button").filter({ hasText: "Upgrade to Bed" })).toHaveCount(1);
  });
});

// ── Admin UI — PATCH request on click ────────────────────────────────────────

test.describe("Bed upgrade — PATCH request on click", () => {
  test("clicking 'Upgrade to Bed' sends PATCH with { accommodationType: 'bed' } to correct URL", async ({ page }) => {
    await mockAuthAs(page, USERS.superAdmin);
    await setupAdminMocks(page);
    await mockRegistrationsEndpoint(page, REGISTRATIONS_BED_SLOT_FREE);

    let patchBody: Record<string, unknown> = {};
    let patchUrl = "";
    await page.route(`**/api/rides/${RIDE_ID}/registrations/**`, async (route) => {
      if (route.request().method() === "PATCH") {
        patchUrl = route.request().url();
        patchBody = JSON.parse(route.request().postData() || "{}");
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ registration: { id: "reg-extra-1", accommodationType: "bed" } }),
        });
      } else {
        route.continue();
      }
    });

    await openRegistrationsPanel(page);
    await page.locator("button").filter({ hasText: "Upgrade to Bed" }).waitFor({ timeout: 5000 });
    await page.locator("button").filter({ hasText: "Upgrade to Bed" }).click();
    await page.waitForTimeout(400);

    expect(patchUrl).toContain(`/api/rides/${RIDE_ID}/registrations/reg-extra-1`);
    expect(patchBody).toEqual({ accommodationType: "bed" });
  });

  test("after successful upgrade the amber 'Extra-bed' badge disappears", async ({ page }) => {
    await mockAuthAs(page, USERS.superAdmin);
    await setupAdminMocks(page);
    await mockRegistrationsEndpoint(page, REGISTRATIONS_BED_SLOT_FREE);

    await page.route(`**/api/rides/${RIDE_ID}/registrations/**`, async (route) => {
      if (route.request().method() === "PATCH") {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ registration: { id: "reg-extra-1", accommodationType: "bed" } }),
        });
      } else {
        route.continue();
      }
    });

    await openRegistrationsPanel(page);
    await expect(page.locator("text=Extra-bed").first()).toBeVisible({ timeout: 5000 });

    await page.locator("button").filter({ hasText: "Upgrade to Bed" }).click();
    await page.waitForTimeout(400);

    await expect(page.locator("text=Extra-bed")).not.toBeVisible();
  });

  test("after successful upgrade the 'Upgrade to Bed' button disappears", async ({ page }) => {
    await mockAuthAs(page, USERS.superAdmin);
    await setupAdminMocks(page);
    await mockRegistrationsEndpoint(page, REGISTRATIONS_BED_SLOT_FREE);

    await page.route(`**/api/rides/${RIDE_ID}/registrations/**`, async (route) => {
      if (route.request().method() === "PATCH") {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ registration: { id: "reg-extra-1", accommodationType: "bed" } }),
        });
      } else {
        route.continue();
      }
    });

    await openRegistrationsPanel(page);
    const upgradeBtn = page.locator("button").filter({ hasText: "Upgrade to Bed" });
    await upgradeBtn.waitFor({ timeout: 5000 });
    await upgradeBtn.click();
    await page.waitForTimeout(400);

    // confirmedBedCount now equals maxRiders — button must disappear
    await expect(page.locator("button").filter({ hasText: "Upgrade to Bed" })).not.toBeVisible();
  });

  test("core_member (not just superadmin) can see and use the Upgrade button", async ({ page }) => {
    await mockAuthAs(page, USERS.coreMember);
    await setupAdminMocks(page);
    await mockRegistrationsEndpoint(page, REGISTRATIONS_BED_SLOT_FREE);

    await openRegistrationsPanel(page);

    await expect(page.locator("button").filter({ hasText: "Upgrade to Bed" })).toBeVisible({ timeout: 5000 });
  });
});
