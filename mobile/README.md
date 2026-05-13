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

- Login / register / forgot-password (OTP-based, mirrors web)
- Sign-out (server-side refresh-token revoke + local secure-store clear)
- Tabs: Home (upcoming rides + notifications), Rides (paginated, filtered),
  Profile (stats, account info, sign-out)
- Ride detail with crew, highlights, confirmed riders, and your own
  registration status when present
- API client with single-flight refresh and one-shot 401 retry

## What's not done yet

Tracked against the plan's Phase 1:

- Ride registration screen (mobile equivalent of the web form, with UPI QR
  and payment-proof upload)
- Live ride join + background GPS tracking (the headline feature — needs
  `expo-task-manager` + foreground service notification)
- Live ride map with `react-native-maps`, breaks, deviation alerts
- Share card via `react-native-view-shot` (1080×1920) + share sheet
- Push notifications (FCM/APNs) — backend route `POST /api/v1/devices`
  exists; mobile registration + server-side push dispatch still TBD
- Garage CRUD, badges, leaderboard, guidelines (read-only screens are
  straightforward but not built yet)
- Blogs and ride-posts (Phase 2)
- Admin features (Phase 3)
- Sentry integration
- E2E with Maestro

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
