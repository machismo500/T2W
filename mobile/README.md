# T2W Mobile (iOS — Android scaffolded later)

Expo SDK 53 / React Native 0.76 / TypeScript. Talks to the existing T2W
backend exclusively via the new `/api/v1/*` namespace (bearer auth, rotating
refresh tokens).

This is the initial scaffold from the plan in
`../docs/mobile-apps-plan.md`. iOS is the primary target for v1 of the apps.

## Prerequisites

- Node 22+
- Xcode 16+ (iOS) — install Command Line Tools and accept the licence.
- An Apple Developer account (free works for simulator; paid required for
  TestFlight / App Store).
- (Optional) `eas-cli` globally: `npm install -g eas-cli`.

## First-time setup

```bash
cd mobile
cp .env.example .env           # then edit EXPO_PUBLIC_API_BASE_URL
npm install
npx expo prebuild --platform ios
```

`prebuild` generates the native `ios/` project (it's gitignored — we use
the managed-workflow's app.json as the source of truth, but native code
can be added in `ios/` later if needed).

## Running locally

For most work the simulator with a development build is fastest:

```bash
# In one terminal, the dev server:
npm run start

# In another, build & launch in the iOS simulator:
npm run ios
```

If you're testing on a physical device, point `EXPO_PUBLIC_API_BASE_URL`
at your machine's LAN address (e.g. `http://192.168.1.42:3000`) and make
sure the Next.js dev server is bound to `0.0.0.0`.

## Auth flow

The app stores the **refresh token** in iOS Keychain via `expo-secure-store`
and keeps the **access token** in memory only. The HTTP client at
`src/api/client.ts` will:

1. Refresh the access token (single-flight) when it's missing or within
   60 s of expiry.
2. Retry exactly once on a 401, then surface `ApiClientError`.
3. Call `onUnauthenticated` (wired up by `AuthProvider`) when the refresh
   token is itself rejected — the app flips back to the login screen.

If the backend detects refresh-token reuse (same token presented twice),
every refresh token for that user is revoked server-side and the app
returns to the login screen.

## Code structure

```
mobile/
├── app/                          # expo-router file-based routing
│   ├── _layout.tsx               # auth gate + QueryClient + Stack
│   ├── (auth)/                   # login, register, forgot-password
│   ├── (tabs)/                   # home, rides, profile
│   └── ride/[id].tsx             # ride detail
├── src/
│   ├── api/                      # client (with refresh), typed wrappers, types, storage
│   ├── auth/AuthProvider.tsx     # auth state, login/register/logout, user
│   ├── components/               # Button, TextField, RideCard, Screen
│   └── theme.ts                  # colours, spacing, type scale (matches web tailwind)
├── app.json                      # Expo config (incl. iOS Info.plist usage strings)
├── eas.json                      # Build & submit profiles
└── README.md                     # this file
```

## What's wired up

- **Auth** — login / register (OTP) / forgot-password (4-step reset). Refresh
  token in Keychain, rotating on every refresh, reuse-detection on the server.
- **Push registration** — Expo push token requested + posted to
  `POST /api/v1/devices` automatically after login; deregistered on sign-out.
- **Tabs**:
  - **Home** — upcoming rides preview, notifications, pending-approval banner.
  - **Rides** — paginated list with status filter (upcoming / live / past / all).
  - **Arena** — leaderboard with 6m / 1y / all-time filter.
  - **Profile** — stats, account info, links to garage / guidelines / blogs.
- **Ride detail** with crew, highlights, confirmed riders, registration CTA.
- **Ride registration** — full form with UPI QR (generated from `upi_config`
  site setting), payment-screenshot upload via `expo-image-picker` →
  `POST /api/v1/upload`.
- **Live ride** (the headline feature):
  - Background GPS via `expo-task-manager` + foreground service on Android.
  - Local AsyncStorage queue that batches up to 50 points every 30 s.
  - One-shot retry, survives offline + reconnect.
  - `react-native-maps` view with lead-rider polyline, your polyline, planned
    route overlay, and per-rider markers (lead/sweep/others colour-coded).
  - Real-time metrics (group + personal): distance, moving time, avg/max speed.
- **Garage** — list + add + remove motorcycles.
- **Guidelines** and **Blogs** (read-only).
- **API client** with single-flight refresh and one-shot 401 retry.

## Push notifications

Push is now end-to-end:

1. Mobile registers an Expo push token at login via
   `POST /api/v1/devices`. Tokens are stored per `(userId, deviceId)`.
2. Server-side dispatch lives in `src/lib/push/dispatch.ts` and is called
   from every notification-creation path on the backend (account approval,
   bulk approval, ride registration approval / rejection / drop-out, blog
   approval, ride-post approval, ride reminder fan-out).
3. Each dispatch both inserts a `Notification` row (durable record for the
   in-app feed) and pushes to every active device. Tokens that come back as
   `DeviceNotRegistered` are pruned automatically.
4. Tap handling: `installNotificationHandlers()` in `src/push/index.ts`
   listens for `addNotificationResponseReceivedListener` and routes by the
   `data.kind` field (`ride`, `blog`, `account_approved`). Cold-start taps
   are handled via `getLastNotificationResponseAsync` on app launch.

## Sentry

Initialised once at startup from `src/sentry.ts`. Set
`EXPO_PUBLIC_SENTRY_DSN` in `.env` to enable; without a DSN the module
no-ops. User identity is attached on auth transition (`AuthProvider`) so
crashes are tied to the rider.

## Post-ride share card

`app/ride/[id]/share.tsx` renders a 1080×1920 card off-screen,
captures it with `react-native-view-shot`, and opens the native share
sheet via `expo-sharing`. The same screen lets the rider pick a
background photo and up to 4 stats from the live-metrics endpoint.

## What's not done yet

- Ride post-ride summary (smoothed distance, splits, elevation) — currently
  uses the lighter `/api/v1/rides/:id/live/metrics` shape.
- Ride posts (community photo posts).
- Admin moderation surfaces.
- E2E with Maestro.

## A note on Expo dependency versions

`package.json` pins compatible versions for Expo SDK 53 / RN 0.76, but Expo
sometimes ships patch bumps within an SDK. After `npm install`, run:

```bash
npx expo install --check
```

to align any drift before building. This is a no-op if everything is in
range.

## Submitting to TestFlight

```bash
eas login
eas build:configure          # one-time: links the project to EAS
eas build --profile preview --platform ios     # internal testers
eas build --profile production --platform ios  # release build
eas submit --platform ios
```

Make sure `app.json -> expo.extra.eas.projectId` and `eas.json -> submit.production.ios.*`
are filled in first.

## Backend dependency

This app depends on the new `/api/v1/*` routes in the Next.js backend.
They live in `src/app/api/v1/` and were added alongside this scaffold.
See `docs/mobile-apps-plan.md` §5 for the full route surface.
