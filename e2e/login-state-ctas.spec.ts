import { test, expect, type Page, type Route } from "@playwright/test";
import {
  mockAuthAs,
  USERS,
  mockRidesList,
  mockRolePermissions,
  MOCK_RIDES,
} from "./helpers";

// Three home/list CTAs that need to respect the logged-in state:
//   1. Hero "Start Your Journey" → /register anonymous, /profile when signed in
//   2. HowToJoin onboarding section → hidden entirely when signed in
//   3. Rides listing card → swaps "Register →" for a status pill when the
//      viewer is already registered for that ride

// Mock the next-ride snippet on the hero so the homepage doesn't 404 out
// on missing data. The hero fetches /api/rides?status=upcoming on mount.
async function mockHome(page: Page) {
  await mockRolePermissions(page);
  await mockRidesList(page, MOCK_RIDES);
  await page.route("/api/stats**", (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        activeRiders: 100,
        ridesCompleted: 20,
        kmsCovered: 50000,
        countriesRidden: 3,
      }),
    })
  );
}

test.describe("Home page CTAs respect login state", () => {
  test("anonymous: 'Start Your Journey' targets /register", async ({ page }) => {
    await mockAuthAs(page, USERS.unauthenticated);
    await mockHome(page);
    await page.goto("/");

    const cta = page.getByRole("link", { name: /Start Your Journey/i });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute("href", "/register");
  });

  test("logged-in rider with a linked rider profile: CTA targets /rider/<id>", async ({ page }) => {
    // Earlier version of this test only asserted href="/profile" — a route
    // that doesn't exist in the app — and the user caught the 404 manually.
    // The contract that matters is that the link points at a route the
    // app actually serves: /rider/<linkedRiderId> when linked, else /rides.
    await mockAuthAs(page, { ...USERS.rider, linkedRiderId: "rider-rider" });
    await mockHome(page);
    await page.goto("/");

    await expect(page.getByRole("link", { name: /Start Your Journey/i })).toHaveCount(0);
    const cta = page.getByRole("link", { name: /View Profile/i });
    await expect(cta).toBeVisible();
    // Specifically must NOT be /profile — that's the bug.
    await expect(cta).not.toHaveAttribute("href", "/profile");
    await expect(cta).toHaveAttribute("href", "/rider/rider-rider");
  });

  test("logged-in user without linkedRiderId falls back to /rides", async ({ page }) => {
    await mockAuthAs(page, { ...USERS.rider, linkedRiderId: null });
    await mockHome(page);
    await page.goto("/");
    const cta = page.getByRole("link", { name: /View Profile/i });
    await expect(cta).toHaveAttribute("href", "/rides");
  });

  test("anonymous: 'How to Join the Ride Group?' onboarding section is shown", async ({ page }) => {
    await mockAuthAs(page, USERS.unauthenticated);
    await mockHome(page);
    await page.goto("/");

    await expect(page.getByText(/How to Join the Ride Group/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /Join Now/i })).toBeVisible();
  });

  test("logged-in: onboarding section is hidden", async ({ page }) => {
    await mockAuthAs(page, USERS.rider);
    await mockHome(page);
    await page.goto("/");

    await expect(page.getByText(/How to Join the Ride Group/i)).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Join Now/i })).toHaveCount(0);
  });
});

test.describe("Rides list reflects my registration status", () => {
  // Lightweight ride payload with myRegistrationStatus set on each card.
  const RIDES = [
    { ...MOCK_RIDES[0], id: "ride-confirmed", status: "upcoming", myRegistrationStatus: "confirmed" },
    { ...MOCK_RIDES[0], id: "ride-pending", status: "upcoming", myRegistrationStatus: "pending" },
    { ...MOCK_RIDES[0], id: "ride-rejected", status: "upcoming", myRegistrationStatus: "rejected" },
    { ...MOCK_RIDES[0], id: "ride-open", status: "upcoming", myRegistrationStatus: null },
  ];

  test("renders a 'Registered' pill instead of 'Register →' when confirmed", async ({ page }) => {
    await mockAuthAs(page, USERS.rider);
    await mockRolePermissions(page);
    await mockRidesList(page, RIDES);
    await page.goto("/rides");

    // Scoped to the ride card so we don't conflict with header / page chrome.
    const confirmedCard = page.locator(`a[href="/ride/ride-confirmed"]`);
    await expect(confirmedCard.getByText(/Registered/i)).toBeVisible();
    await expect(confirmedCard.getByText(/^Register$/)).toHaveCount(0);
  });

  test("renders 'Pending approval' on a pending registration", async ({ page }) => {
    await mockAuthAs(page, USERS.rider);
    await mockRolePermissions(page);
    await mockRidesList(page, RIDES);
    await page.goto("/rides");

    const pendingCard = page.locator(`a[href="/ride/ride-pending"]`);
    await expect(pendingCard.getByText(/Pending approval/i)).toBeVisible();
  });

  test("renders 'Register →' on rides the user has not joined", async ({ page }) => {
    await mockAuthAs(page, USERS.rider);
    await mockRolePermissions(page);
    await mockRidesList(page, RIDES);
    await page.goto("/rides");

    const openCard = page.locator(`a[href="/ride/ride-open"]`);
    await expect(openCard.getByText("Register", { exact: true })).toBeVisible();
  });
});
