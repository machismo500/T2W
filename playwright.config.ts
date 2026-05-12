import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  // Single retry under CI so a one-off flake doesn't block a merge; zero
  // retries locally so flakes are visible during development.
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  timeout: 30000,
  use: {
    baseURL: "http://localhost:3001",
    trace: "on-first-retry",
    extraHTTPHeaders: {
      Accept: "application/json",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npx next dev --port 3001",
    port: 3001,
    reuseExistingServer: true,
    timeout: 60000,
    env: {
      // Stub the Google Maps key so the loader effect creates the script
      // tag that mockGoogleMaps intercepts. Any non-empty value works —
      // the real key is never used in tests.
      NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "stub-for-tests",
      DATABASE_URL: process.env.DATABASE_URL || "postgresql://dummy:dummy@localhost:5432/dummy",
      DATABASE_URL_UNPOOLED:
        process.env.DATABASE_URL_UNPOOLED || "postgresql://dummy:dummy@localhost:5432/dummy",
    },
  },
});
