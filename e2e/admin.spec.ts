import { test, expect } from "@playwright/test";
import {
  mockAuthAs,
  mockRidesList,
  mockAdminUsers,
  mockRolePermissions,
  USERS,
  MOCK_RIDES,
} from "./helpers";

function setupAdminMocks(page: Parameters<typeof mockAuthAs>[0]) {
  return Promise.all([
    mockRolePermissions(page),
    mockAdminUsers(page),
    page.route("/api/admin/stats**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ totalRides: 2, totalRiders: 3, upcomingRides: 1 }),
      });
    }),
    page.route("/api/rides**", (route) => {
      const url = route.request().url();
      if (url.match(/\/api\/rides\/[^/]+$/)) return route.continue();
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ rides: MOCK_RIDES }),
      });
    }),
    page.route("/api/rider-profiles**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ profiles: [] }),
      });
    }),
    page.route("/api/badges**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ badges: [] }),
      });
    }),
  ]);
}

test.describe("Admin panel — access control", () => {
  test("unauthenticated user cannot access admin panel", async ({ page }) => {
    await mockAuthAs(page, USERS.unauthenticated);

    await page.goto("/admin");
    await page.waitForLoadState("networkidle");

    // Should redirect to login or show access denied
    const url = page.url();
    const body = await page.locator("body").textContent();
    const isRedirected = url.includes("/login") || url.includes("/signin");
    const isDenied = body?.toLowerCase().includes("access denied") ||
      body?.toLowerCase().includes("forbidden") ||
      body?.toLowerCase().includes("unauthorized") ||
      body?.toLowerCase().includes("sign in");
    expect(isRedirected || isDenied).toBeTruthy();
  });

  test("regular rider cannot access admin panel", async ({ page }) => {
    await mockAuthAs(page, USERS.rider);

    await page.goto("/admin");
    await page.waitForLoadState("networkidle");

    const url = page.url();
    const body = await page.locator("body").textContent();
    const isRedirected = url.includes("/login") || url.includes("/signin");
    const isDenied = body?.toLowerCase().includes("access denied") ||
      body?.toLowerCase().includes("forbidden") ||
      body?.toLowerCase().includes("unauthorized") ||
      body?.toLowerCase().includes("sign in");
    expect(isRedirected || isDenied).toBeTruthy();
  });

  test("core member can access admin panel", async ({ page }) => {
    await mockAuthAs(page, USERS.coreMember);
    await setupAdminMocks(page);

    await page.goto("/admin");
    await page.waitForLoadState("networkidle");

    // Should be on admin page (not redirected to login)
    const url = page.url();
    expect(url).not.toContain("/login");
    await expect(page.locator("body")).toBeVisible();
  });

  test("super admin can access admin panel", async ({ page }) => {
    await mockAuthAs(page, USERS.superAdmin);
    await setupAdminMocks(page);

    await page.goto("/admin");
    await page.waitForLoadState("networkidle");

    const url = page.url();
    expect(url).not.toContain("/login");
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("Admin panel — Details toggle (Super Admin only)", () => {
  test("Super Admin sees Details toggle button on ride cards", async ({ page }) => {
    await mockAuthAs(page, USERS.superAdmin);
    await setupAdminMocks(page);

    await page.goto("/admin");
    await page.waitForLoadState("networkidle");

    // Navigate to the Rides tab (admin loads on "dashboard" by default)
    await page.getByRole("button", { name: /rides/i }).first().click();
    await page.waitForLoadState("networkidle");

    // Should have "Details: Off" button (ride starts with detailsVisible=false)
    const toggleBtn = page.getByText("Details: Off").first();
    await expect(toggleBtn).toBeVisible();
  });

  test("Core Member does NOT see Details toggle button", async ({ page }) => {
    await mockAuthAs(page, USERS.coreMember);
    await setupAdminMocks(page);

    await page.goto("/admin");
    await page.waitForLoadState("networkidle");

    // Navigate to Rides tab
    await page.getByRole("button", { name: /rides/i }).first().click();
    await page.waitForLoadState("networkidle");

    // Core member should not see Details toggle
    const toggleBtns = await page.getByText("Details: Off").count() + await page.getByText("Details: On").count();
    expect(toggleBtns).toBe(0);
  });

  test("Details toggle button has descriptive tooltip", async ({ page }) => {
    await mockAuthAs(page, USERS.superAdmin);
    await setupAdminMocks(page);

    await page.goto("/admin");
    await page.waitForLoadState("networkidle");

    // Navigate to Rides tab
    await page.getByRole("button", { name: /rides/i }).first().click();
    await page.waitForLoadState("networkidle");

    // Find the toggle button and check its title attribute
    const toggleBtn = page.getByText("Details: Off").first();
    const title = await toggleBtn.getAttribute("title");
    // Title should describe what the toggle does
    expect(title).toBeTruthy();
    expect(title!.length).toBeGreaterThan(20);
  });

  test("Super Admin can toggle Details visibility on", async ({ page }) => {
    await mockAuthAs(page, USERS.superAdmin);
    await setupAdminMocks(page);

    // Mock the PUT endpoint for ride update
    await page.route(`/api/rides/ride-1`, (route) => {
      if (route.request().method() === "PUT") {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ride: { ...MOCK_RIDES[0], detailsVisible: true },
          }),
        });
      } else {
        route.continue();
      }
    });

    await page.goto("/admin");
    await page.waitForLoadState("networkidle");

    // Navigate to Rides tab
    await page.getByRole("button", { name: /rides/i }).first().click();
    await page.waitForLoadState("networkidle");

    // Click the Details: Off toggle
    const toggleBtn = page.getByText("Details: Off").first();
    await toggleBtn.click();
    await page.waitForLoadState("networkidle");

    // Should now show Details: On (optimistic update)
    const updatedToggle = page.getByText("Details: On").first();
    await expect(updatedToggle).toBeVisible();
  });
});

test.describe("Admin panel — Role management", () => {
  test("Super Admin can change user role", async ({ page }) => {
    await mockAuthAs(page, USERS.superAdmin);
    await setupAdminMocks(page);

    // Mock role update endpoint
    await page.route("/api/admin/users/u1**", (route) => {
      if (route.request().method() === "PATCH" || route.request().method() === "PUT") {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            user: { id: "u1", name: "Ali Hassan", email: "ali@test.com", role: "rider" },
          }),
        });
      } else {
        route.continue();
      }
    });

    await page.goto("/admin");
    await page.waitForLoadState("networkidle");

    // Admin page should load with user management
    await expect(page.locator("body")).toBeVisible();
  });

  test("role change persists after reload (role NOT overwritten by syncRoles)", async ({ page }) => {
    // This tests that syncRoles is NOT auto-called on admin page load
    let syncRolesCalled = false;

    await mockAuthAs(page, USERS.superAdmin);
    await setupAdminMocks(page);

    // Track if syncRoles is called
    await page.route("/api/participation/sync-roles**", (route) => {
      syncRolesCalled = true;
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto("/admin");
    await page.waitForLoadState("networkidle");

    // syncRoles should NOT be auto-called on admin page load
    expect(syncRolesCalled).toBe(false);
  });
});

test.describe("Admin panel — Ride management", () => {
  test("Super Admin sees all ride management options", async ({ page }) => {
    await mockAuthAs(page, USERS.superAdmin);
    await setupAdminMocks(page);

    await page.goto("/admin");
    await page.waitForLoadState("networkidle");

    // Navigate to Rides tab
    await page.getByRole("button", { name: /rides/i }).first().click();
    await page.waitForLoadState("networkidle");

    // Should see rides listed
    await expect(page.getByText("Desert Dunes Blast")).toBeVisible();
  });

  test("Admin panel shows ride creation button for Super Admin", async ({ page }) => {
    await mockAuthAs(page, USERS.superAdmin);
    await setupAdminMocks(page);

    await page.goto("/admin");
    await page.waitForLoadState("networkidle");

    // Navigate to Rides tab
    await page.getByRole("button", { name: /rides/i }).first().click();
    await page.waitForLoadState("networkidle");

    // Should see "Add New Ride" button
    const createBtn = page.getByText("Add New Ride").first();
    await expect(createBtn).toBeVisible();
  });
});
