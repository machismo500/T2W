/**
 * k6 performance test suite for T2W API.
 *
 * Usage (requires k6 installed):
 *   BASE_URL=https://your-app.vercel.app k6 run k6/performance.js
 *
 * Or against the local dev server:
 *   BASE_URL=http://localhost:3000 k6 run k6/performance.js
 *
 * Thresholds (SLOs):
 *   - 95th percentile response time < 500 ms for all requests
 *   - Error rate < 1% per endpoint
 *   - Throughput: public endpoints handle 50 concurrent VUs for 30 s
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

// ── Configuration ─────────────────────────────────────────────────────────────

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

// Custom metrics
const errorRate = new Rate("error_rate");
const ridesListLatency = new Trend("rides_list_latency");
const rideDetailLatency = new Trend("ride_detail_latency");
const authMeLatency = new Trend("auth_me_latency");
const badgesLatency = new Trend("badges_latency");
const leaderboardLatency = new Trend("leaderboard_latency");

// ── Options ───────────────────────────────────────────────────────────────────

export const options = {
  scenarios: {
    // Smoke test: single VU, short duration — baseline correctness check
    smoke: {
      executor: "constant-vus",
      vus: 1,
      duration: "10s",
      tags: { scenario: "smoke" },
    },

    // Load test: ramp up to 50 concurrent users over 1 minute
    load: {
      executor: "ramping-vus",
      startVUs: 1,
      stages: [
        { duration: "20s", target: 10 },
        { duration: "30s", target: 50 },
        { duration: "10s", target: 0 },
      ],
      startTime: "10s", // starts after smoke
      tags: { scenario: "load" },
    },

    // Spike test: sudden burst of 100 VUs for 15 seconds
    spike: {
      executor: "constant-vus",
      vus: 100,
      duration: "15s",
      startTime: "80s", // starts after load
      tags: { scenario: "spike" },
    },
  },

  thresholds: {
    // Overall HTTP response time
    http_req_duration: ["p(95)<500", "p(99)<1000"],

    // Per-endpoint latency thresholds
    rides_list_latency: ["p(95)<400"],
    ride_detail_latency: ["p(95)<400"],
    auth_me_latency: ["p(95)<300"],
    badges_latency: ["p(95)<400"],
    leaderboard_latency: ["p(95)<500"],

    // Error rate: less than 1% overall errors
    error_rate: ["rate<0.01"],

    // HTTP failures (4xx/5xx) stay under 2%
    http_req_failed: ["rate<0.02"],
  },
};

// ── Shared headers ────────────────────────────────────────────────────────────

const JSON_HEADERS = { "Content-Type": "application/json" };

// ── Main virtual user script ──────────────────────────────────────────────────

export default function () {
  // 1. Public rides list
  const ridesRes = http.get(`${BASE_URL}/api/rides?page=1&pageSize=20`);
  ridesListLatency.add(ridesRes.timings.duration);
  const ridesOk = check(ridesRes, {
    "rides list: status 200": (r) => r.status === 200,
    "rides list: has rides array": (r) => {
      try {
        const body = r.json();
        return Array.isArray(body.rides);
      } catch {
        return false;
      }
    },
  });
  errorRate.add(!ridesOk);

  sleep(0.5);

  // 2. Auth check (unauthenticated — should 401 quickly)
  const meRes = http.get(`${BASE_URL}/api/auth/me`);
  authMeLatency.add(meRes.timings.duration);
  const meOk = check(meRes, {
    "auth/me: returns 401 without cookie": (r) => r.status === 401,
    "auth/me: responds under 300 ms": (r) => r.timings.duration < 300,
  });
  errorRate.add(!meOk);

  sleep(0.5);

  // 3. Badges list (public)
  const badgesRes = http.get(`${BASE_URL}/api/badges`);
  badgesLatency.add(badgesRes.timings.duration);
  const badgesOk = check(badgesRes, {
    "badges: not 5xx": (r) => r.status < 500,
  });
  errorRate.add(!badgesOk);

  sleep(0.5);

  // 4. Leaderboard (public)
  const lbRes = http.get(`${BASE_URL}/api/leaderboard?limit=20`);
  leaderboardLatency.add(lbRes.timings.duration);
  const lbOk = check(lbRes, {
    "leaderboard: not 5xx": (r) => r.status < 500,
  });
  errorRate.add(!lbOk);

  sleep(0.5);

  // 5. Health check
  const healthRes = http.get(`${BASE_URL}/api/health`);
  check(healthRes, {
    "health: 200": (r) => r.status === 200,
  });

  sleep(1);
}

// ── Auth scenario (requires valid credentials in env) ─────────────────────────

export function authScenario() {
  const email = __ENV.TEST_EMAIL;
  const password = __ENV.TEST_PASSWORD;
  if (!email || !password) return;

  // Login
  const loginRes = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email, password }),
    { headers: JSON_HEADERS }
  );

  check(loginRes, {
    "login: 200": (r) => r.status === 200,
    "login: returns user": (r) => {
      try {
        return Boolean(r.json("user"));
      } catch {
        return false;
      }
    },
  });

  // Extract session cookie
  const cookies = loginRes.cookies;
  const sessionCookie = Object.values(cookies)[0];
  if (!sessionCookie) return;

  const authHeaders = {
    Cookie: `${sessionCookie[0].name}=${sessionCookie[0].value}`,
  };

  sleep(0.5);

  // Authenticated profile fetch
  const meRes = http.get(`${BASE_URL}/api/auth/me`, { headers: authHeaders });
  check(meRes, {
    "authed /me: 200": (r) => r.status === 200,
  });

  sleep(0.5);

  // Authenticated rides list
  const ridesRes = http.get(`${BASE_URL}/api/rides`, { headers: authHeaders });
  check(ridesRes, {
    "authed rides: 200": (r) => r.status === 200,
  });

  sleep(1);
}
