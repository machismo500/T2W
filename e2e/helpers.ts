import type { Page, Route } from "@playwright/test";

// ── Shared mock data ──────────────────────────────────────────────────────────

export const MOCK_RIDES = [
  {
    id: "ride-1",
    title: "Desert Dunes Blast",
    rideNumber: "#001",
    type: "day",
    status: "upcoming",
    startDate: new Date(Date.now() + 7 * 86400000).toISOString(),
    endDate: new Date(Date.now() + 7 * 86400000 + 28800000).toISOString(),
    startLocation: "Riyadh",
    endLocation: "Al Kharj",
    startLocationUrl: null,
    endLocationUrl: null,
    route: [],
    distanceKm: 180,
    maxRiders: 40,
    registeredRiders: 12,
    activeRegistrations: 14,
    difficulty: "moderate",
    description: "An exhilarating desert ride.",
    highlights: ["Scenic dunes", "Campfire stop"],
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
    regOpenCore: null,
    regOpenT2w: null,
    regOpenRider: null,
    detailsVisible: false,
  },
  {
    id: "ride-2",
    title: "Mountain Pass Challenge",
    rideNumber: "#002",
    type: "overnight",
    status: "completed",
    startDate: new Date(Date.now() - 14 * 86400000).toISOString(),
    endDate: new Date(Date.now() - 13 * 86400000).toISOString(),
    startLocation: "Taif",
    endLocation: "Abha",
    startLocationUrl: null,
    endLocationUrl: null,
    route: [],
    distanceKm: 420,
    maxRiders: 30,
    registeredRiders: 28,
    activeRegistrations: 28,
    difficulty: "hard",
    description: "A challenging mountain route.",
    highlights: ["Mountain views"],
    posterUrl: null,
    fee: 250,
    leadRider: "Khalid",
    sweepRider: "Faisal",
    organisedBy: "T2W",
    accountsBy: null,
    meetupTime: "05:00 AM",
    rideStartTime: "06:00 AM",
    startingPoint: "Main Gate",
    riders: [],
    regOpenCore: null,
    regOpenT2w: null,
    regOpenRider: null,
    detailsVisible: false,
  },
];

export const MOCK_RIDE_DETAIL = {
  ...MOCK_RIDES[0],
  regFormSettings: null,
  participations: [
    {
      id: "part-1",
      riderProfileId: "rp-1",
      riderName: "Ali Hassan",
      riderAvatar: null,
      droppedOut: false,
      points: 10,
    },
  ],
  confirmedRiderNames: ["Ali Hassan", "Sara Malik"],
  currentUserRegistered: false,
  currentUserConfirmationCode: null,
  currentUserApprovalStatus: null,
};

export const MOCK_RIDE_DETAIL_WITH_DETAILS_VISIBLE = {
  ...MOCK_RIDE_DETAIL,
  detailsVisible: true,
  route: [
    { lat: 24.7, lng: 46.7, name: "Start" },
    { lat: 24.8, lng: 46.8, name: "End" },
  ],
};

// ── User mocks ────────────────────────────────────────────────────────────────

export const USERS = {
  unauthenticated: null,
  rider: {
    id: "user-rider",
    email: "rider@test.com",
    name: "Test Rider",
    role: "rider",
  },
  t2wRider: {
    id: "user-t2w",
    email: "t2w@test.com",
    name: "T2W Rider",
    role: "t2w_rider",
  },
  coreMember: {
    id: "user-core",
    email: "core@test.com",
    name: "Core Member",
    role: "core_member",
  },
  superAdmin: {
    id: "user-super",
    email: "super@test.com",
    name: "Super Admin",
    role: "superadmin",
  },
};

// ── Mock helpers ──────────────────────────────────────────────────────────────

export async function mockAuthAs(page: Page, user: typeof USERS[keyof typeof USERS]) {
  await page.route("/api/auth/me", (route: Route) => {
    if (user) {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ user }),
      });
    } else {
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "Unauthorized" }),
      });
    }
  });
}

export async function mockRidesList(page: Page, rides = MOCK_RIDES) {
  await page.route("/api/rides**", (route: Route) => {
    const url = route.request().url();
    // Don't intercept specific ride ID routes here
    if (url.match(/\/api\/rides\/[^/]+$/)) return route.continue();
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ rides }),
    });
  });
}

export async function mockRideDetail(page: Page, ride = MOCK_RIDE_DETAIL) {
  await page.route(`/api/rides/${ride.id}**`, (route: Route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ride }),
    });
  });
}

export async function mockRolePermissions(page: Page) {
  await page.route("/api/admin/role-permissions**", (route: Route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        permissions: {
          core_member: {
            canCreateRide: true,
            canEditRide: true,
            canDeleteRide: false,
            canManageRegistrations: true,
            canControlLiveTracking: true,
            canViewAdminPanel: true,
            canManageUsers: false,
          },
        },
      }),
    });
  });
}

export async function mockAdminUsers(page: Page) {
  await page.route("/api/admin/users**", (route: Route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        users: [
          { id: "u1", name: "Ali Hassan", email: "ali@test.com", role: "t2w_rider", createdAt: new Date().toISOString() },
          { id: "u2", name: "Sara Malik", email: "sara@test.com", role: "rider", createdAt: new Date().toISOString() },
          { id: "u3", name: "Omar Sheikh", email: "omar@test.com", role: "core_member", createdAt: new Date().toISOString() },
        ],
      }),
    });
  });
}

export async function mockRegistrations(page: Page, rideId: string) {
  await page.route(`/api/rides/${rideId}/registrations**`, (route: Route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        registrations: [
          {
            id: "reg-1",
            rideId,
            userId: "user-rider",
            riderName: "Test Rider",
            emergencyContactName: "Mom",
            emergencyContactPhone: "+966500000000",
            confirmationCode: "T2W-ABCD-1234",
            approvalStatus: "confirmed",
            createdAt: new Date().toISOString(),
          },
        ],
      }),
    });
  });
}
