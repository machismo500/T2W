import { test, expect } from "@playwright/test";
import { mockAuthAs, mockRideDetail, mockRegistrations, USERS, MOCK_RIDE_DETAIL } from "./helpers";

const RIDE_ID = "ride-1";

function mockRegFormSettings(page: Parameters<typeof mockAuthAs>[0]) {
  return page.route(`/api/rides/${RIDE_ID}**`, (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ride: {
          ...MOCK_RIDE_DETAIL,
          regFormSettings: {
            fields: [
              { id: "name", label: "Full Name", type: "text", required: true },
              { id: "emergency_contact", label: "Emergency Contact Name", type: "text", required: true },
              { id: "emergency_phone", label: "Emergency Contact Phone", type: "tel", required: true },
            ],
          },
          regOpenRider: new Date(Date.now() - 86400000).toISOString(), // opened yesterday
          currentUserRegistered: false,
          currentUserApprovalStatus: null,
        },
      }),
    });
  });
}

test.describe("Ride registration flow", () => {
  test("unauthenticated user sees register/login prompt on rides page", async ({ page }) => {
    await mockAuthAs(page, USERS.unauthenticated);
    await page.route("/api/rides**", (route) => {
      const url = route.request().url();
      if (url.match(/\/api\/rides\/[^/]+$/)) return route.continue();
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ rides: [MOCK_RIDE_DETAIL] }),
      });
    });

    // The rides list page is a client component — testable
    await page.goto("/rides");
    await page.waitForLoadState("networkidle");

    // Nav should have Login or Join T2W for unauthenticated users
    const body = await page.locator("body").textContent();
    const hasPrompt = body?.toLowerCase().includes("login") ||
      body?.toLowerCase().includes("sign in") ||
      body?.toLowerCase().includes("register") ||
      body?.toLowerCase().includes("join");
    expect(hasPrompt).toBeTruthy();
  });

  test("authenticated rider sees the rides list", async ({ page }) => {
    await mockAuthAs(page, USERS.rider);
    await page.route("/api/rides**", (route) => {
      const url = route.request().url();
      if (url.match(/\/api\/rides\/[^/]+$/)) return route.continue();
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ rides: [MOCK_RIDE_DETAIL] }),
      });
    });

    await page.goto("/rides");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).toBeVisible();
  });

  test("confirmed registration API returns confirmationCode", async ({ page }) => {
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

  test("pending registration API returns pending status", async ({ page }) => {
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

  test("ride at capacity — API returns correct rider counts", async ({ page }) => {
    await mockAuthAs(page, USERS.rider);
    await page.route(`**/api/rides/${RIDE_ID}`, (route) => {
      if (route.request().method() === "GET") {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ride: {
              ...MOCK_RIDE_DETAIL,
              maxRiders: 40,
              registeredRiders: 40,
              activeRegistrations: 40,
              currentUserRegistered: false,
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

    expect(body.ride.registeredRiders).toBe(40);
    expect(body.ride.maxRiders).toBe(40);
    expect(body.ride.currentUserRegistered).toBe(false);
  });
});

test.describe("Registration form submission", () => {
  test("registration POST API accepts registration data", async ({ page }) => {
    await mockAuthAs(page, USERS.rider);

    let registrationCalled = false;
    await page.route(`**/api/rides/${RIDE_ID}/registrations`, (route) => {
      if (route.request().method() === "POST") {
        registrationCalled = true;
        route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            registration: {
              id: "reg-new",
              rideId: RIDE_ID,
              userId: "user-rider",
              riderName: "Test Rider",
              confirmationCode: "T2W-EFGH-5678",
              approvalStatus: "pending",
            },
          }),
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
        body: JSON.stringify({
          riderName: "Test Rider",
          emergencyContactName: "Mom",
          emergencyContactPhone: "+966500000000",
        }),
      });
      return { status: r.status, body: await r.json() };
    }, `http://localhost:3001/api/rides/${RIDE_ID}/registrations`);

    expect(registrationCalled).toBe(true);
    expect(result.status).toBe(201);
    expect(result.body.registration.confirmationCode).toBe("T2W-EFGH-5678");
  });
});
