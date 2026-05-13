# T2W Mobile — Sideload + Offline-First Plan

**Status:** Proposal — pre-execution
**Goal:** Get the iOS app onto your iPhone via Xcode (free Apple ID), then harden the rider golden path so it works cleanly without a network — including the live GPS session.
**Decisions locked (from your answers):**
1. Sideload via **free Apple ID + Xcode**, personal device only. Re-sign every 7 days; no UDID registration, no $99/yr.
2. **Full offline-first for the rider golden path** — browse cached rides, register / write / approve via an outbox, live tracking unaffected by signal.
3. **Local Xcode for iteration, EAS held in reserve** for when you later distribute to other riders.

---

## 1. Constraints the free-Apple-ID path imposes

Worth knowing up front so we don't design around features that won't ship:

| Capability | Works on free Apple ID? | Plan |
|---|---|---|
| Install via Xcode on your iPhone | ✅ | Primary path |
| iOS background location (`UIBackgroundModes=location`) | ✅ | Already wired in `app.json` |
| Local notifications (in-app reminders) | ✅ | Add a local "you have 1 km to next break" style reminder later if useful |
| **Remote push** (FCM/APNs via Expo) | ❌ | Push entitlement requires paid Apple Dev. We **disable remote push on dev builds** and rely on in-app `Notification` rows fetched on app open. Code path stays — it just no-ops without an APNs cert. |
| Universal Links | ⚠️ Partial | `apple-app-site-association` needs the Apple Team ID. Skip for v1 sideload; deep linking works inside the app from notification tap payloads. |
| Keychain access (refresh tokens) | ✅ | Already wired |
| **7-day expiry** | — | App stops launching after 7 days. Build expectation: re-build via Xcode weekly. |
| Bundle ID conflict | ⚠️ | `com.taleson2wheels.app` will fail if anyone else has registered it on Apple's servers. Plan B: use `com.yourname.t2w` during sideload, swap back later. |

---

## 2. Phase A — Get it on the phone (target: half a day)

### A.1 Native iOS project

```bash
cd mobile
npm install
npx expo prebuild --platform ios --clean
```

This generates `mobile/ios/T2W.xcworkspace`. The `ios/` folder is gitignored — we treat `app.json` as the source of truth and re-run `prebuild` whenever `app.json` changes.

### A.2 Personal-build config

We add a `mobile/app.config.ts` (overriding `app.json`) that swaps in a personal bundle ID when `EXPO_PUBLIC_BUILD_VARIANT=personal`. This avoids editing `app.json` (which is committed) and avoids bundle-ID collisions on the Apple side.

```ts
// mobile/app.config.ts
import { ExpoConfig } from "expo/config";
import base from "./app.json";

export default ({ config }: { config: ExpoConfig }): ExpoConfig => {
  const isPersonal = process.env.EXPO_PUBLIC_BUILD_VARIANT === "personal";
  return {
    ...base.expo,
    ...config,
    ios: {
      ...base.expo.ios,
      bundleIdentifier: isPersonal
        ? process.env.EXPO_PUBLIC_PERSONAL_BUNDLE_ID ?? "com.t2w.sideload"
        : base.expo.ios.bundleIdentifier,
    },
  };
};
```

`.env`:
```
EXPO_PUBLIC_API_BASE_URL=https://taleson2wheels.com
EXPO_PUBLIC_BUILD_VARIANT=personal
EXPO_PUBLIC_PERSONAL_BUNDLE_ID=com.yourgithubname.t2w
```

### A.3 Assets

Generate the three required icon assets from the existing
`TalesOn2Wheels_One_White.Trnsprnt.png` logo:

- `mobile/assets/icon.png` — 1024×1024, no transparency, no rounded corners (Apple rounds it)
- `mobile/assets/adaptive-icon.png` — 1024×1024, the foreground only (background is set in `app.json`)
- `mobile/assets/splash.png` — 1242×2436 or any 9:19.5 ratio, logo centred on dark bg

Plan calls for using `npx expo-cli generate-assets` or running ImageMagick locally. Either way, commit the outputs.

### A.4 Push & Sentry on dev builds

- **Push registration** is wrapped to no-op when there's no projectId or when running on a development scheme. The mobile code at `src/push/index.ts` already early-returns when `Device.isDevice === false` or `projectId` is missing — we extend that check to also skip when bundle ID starts with `com.t2w.sideload` (heuristic for personal builds).
- **Sentry** stays on; set `EXPO_PUBLIC_SENTRY_DSN` if you want crash reports flowing during personal use.

### A.5 The Xcode workflow

Documented in `mobile/SIDELOAD.md` (added during execution):

1. `cd mobile && npx expo prebuild --platform ios --clean` (after any `app.json` change)
2. `open ios/T2W.xcworkspace`
3. Select the **T2W** target → **Signing & Capabilities** → set Team to your free personal Apple ID → set Bundle Identifier to something unique → enable Automatic Signing.
4. Connect iPhone via cable, select it in the toolbar.
5. **Product → Run** (⌘R). Xcode installs the app and starts the JS bundler.
6. On the phone: Settings → General → VPN & Device Management → trust the developer profile.

### A.6 Backend wiring for personal builds

The mobile app talks to the same Postgres as the web. No backend changes required to ship a personal build pointing at production.

For safer development, plan to:
- Set `EXPO_PUBLIC_API_BASE_URL` to a Vercel preview URL during testing
- Or stand up `vercel dev` locally and point the app at your LAN IP

### A.7 Acceptance (Phase A done when…)

- iPhone launches the app and reaches the login screen offline.
- Login (online) → home tab shows upcoming rides.
- App icon and splash render correctly.
- App stays installed for 7 days without re-signing.

---

## 3. Phase B — Offline-first rider golden path (target: 3–5 days)

The goal: a rider can open the app in a dead zone, see the rides they were planning to do, see their own profile, start a live ride, log GPS for hours, then resync everything on reconnect — without losing data.

### B.1 Persistent query cache

TanStack Query is already in use but its cache evaporates on app kill. Plan to wire `@tanstack/react-query-persist-client` + `@tanstack/query-async-storage-persister`:

```ts
// mobile/app/_layout.tsx (sketch)
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: "t2w.query-cache-v1",
  throttleTime: 1000,
});

<PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 * 7 }}>
  …
</PersistQueryClientProvider>
```

- `staleTime` per query stays at 30 s (so the UI refetches on focus when online).
- Hydration on app launch is synchronous from AsyncStorage — first paint shows last-known-good data immediately, then network reconciles.
- Bump the cache `key` to invalidate on schema changes.

### B.2 Network-status banner & global awareness

Add `useNetInfo()` (from `@react-native-community/netinfo` — Expo bundles this). One global hook + a thin banner component that appears at the top of every screen when offline.

```ts
// mobile/src/lib/network.ts
import { useNetInfo } from "@react-native-community/netinfo";
export function useIsOffline() {
  const net = useNetInfo();
  return net.isConnected === false || net.isInternetReachable === false;
}
```

UI:
- `<OfflineBanner />` in the root layout, sits above the tab bar.
- Disabled state on every "submit" button when offline (unless the action is outbox-supported).

### B.3 Mutation outbox

The make-or-break piece. Replace direct mutations with an outbox that survives app restart.

**Outbox model** (single AsyncStorage key, FIFO array of pending operations):

```ts
type OutboxOp =
  | { kind: "ride.register"; rideId: string; body: RegistrationBody; tempId: string }
  | { kind: "ride-post.create"; rideId: string; body: { content: string; images: string[] }; tempId: string }
  | { kind: "notification.read"; id: string }
  | { kind: "motorcycle.create"; body: CreateMotorcycleBody; tempId: string }
  | { kind: "admin.user.approve"; userId: string }
  | { kind: "admin.registration.moderate"; regId: string; body: { approvalStatus: string } }
  | { kind: "live.break.start"; rideId: string; reason: string | null }
  | { kind: "live.break.end"; rideId: string };
```

**Behaviour:**
1. Every mutation goes through `outbox.enqueue(op)` first — that returns a synthetic optimistic result.
2. A background flusher (similar to the live-location flusher) drains the queue when `NetInfo.isConnected` flips to true.
3. Each op is dispatched to the existing typed API client. Success → drop from queue + invalidate matching queries. Failure → exponential backoff; on 4xx errors (e.g. `RIDE_FULL`, `ALREADY_REGISTERED`) mark as **permanently failed** and surface a banner.
4. The outbox is rendered as a "Pending" section in the relevant screen (e.g. ride detail shows "Your registration is queued — will submit when online").

Files (planned):

```
mobile/src/outbox/
├── types.ts        # OutboxOp union + status types
├── store.ts        # AsyncStorage CRUD (enqueue, peek, ack, fail)
├── flusher.ts      # Single-flight drain loop, hooks into NetInfo
├── handlers.ts     # OutboxOp → api-client call mapping
└── useOutbox.ts    # React hook for surfacing pending items in UI
```

**Not in scope:** real conflict resolution. If two admins approve the same rider while one is offline, the second wins on flush and the first sees a 4xx. We surface that as a banner; no merge UI for v1.

### B.4 Auth resilience on flaky networks

Current client throws `ApiClientError` on refresh failure and immediately flips to anon. On a transient network blip that's overkill — the user sees the login screen mid-ride.

Plan:
- Distinguish **network errors** (no connection / DNS / timeout) from **auth errors** (401, 403, TOKEN_REUSED) in `ApiClientError`.
- On network error during refresh, keep the cached `AuthUser` in memory and surface "Reconnecting…" instead of logging out.
- Only flip to anon on a definitive auth rejection.

### B.5 Live ride hardening

Already 90% there. Plan to close the remaining gaps:

1. **Don't re-flush points that the server already accepted.** Current flusher drops `batch.length` after a successful response. If the response was partial (some `rejected[]`), we keep the rejected ones. Today we drop them all. Fix: keep the rejected ones in-queue with a "permanently bad" marker so they don't loop forever — but log them to Sentry.
2. **Re-issue access token mid-ride.** When the access token expires after 15 min, the flusher's POST gets a 401 and refresh kicks in. Test this path — currently it works through `apiFetch` but the flusher might race during refresh.
3. **Battery-optimisation explainer** on first start (already partial — we surface a string but don't link out). Add a dedicated screen at `/settings/battery-tips` with per-OEM guidance + a "Test background tracking" button that starts a 60-second dummy session and reports how many points it captured.
4. **iOS Background App Refresh** detection: `expo-background-fetch` or a check on `BackgroundFetch.getStatusAsync()`. If disabled, show a warning at ride start.
5. **Recovery from a killed app**: when the app relaunches and the active ride id is still set in AsyncStorage, ask the user "You were tracking ride X — resume?" The TaskManager task survives app death on iOS, but our flusher doesn't restart automatically.

### B.6 Map tiles offline

`react-native-maps` (Google provider) does **not** cache tiles natively. Three pragmatic options:

| Option | Effort | Quality |
|---|---|---|
| **A. Polyline-only when offline** (chosen for v1) | None | Acceptable — you still see your path and the planned route, just no streets behind them. |
| B. Pre-download a `UrlTile` cache to local FS at ride start | Medium | Streets visible offline but adds 50–200 MB to the ride start, depends on bounding box and zoom. |
| C. Switch to MapLibre with native offline regions | Large | Best long-term; OSM tiles, vector, official offline downloads. Multi-day migration. |

We ship **A** for the sideload milestone. The map shows tiles when online and falls back to a dark background + polyline when offline. Document **B/C** as follow-ups in the plan.

### B.7 Image cache

Already using `expo-image` (it has built-in disk cache). Plan to:
- Set `cachePolicy="memory-disk"` on every `<Image>` displaying a remote URL (ride poster, avatar, payment proof).
- Prefetch poster + lead avatar on ride detail mount via `Image.prefetch`.

### B.8 Pre-cache the rider's "essentials"

When the user is signed in and online, fetch and persist the following so an offline open shows real data:

- `GET /api/v1/auth/me` — user + motorcycles + earned badges
- `GET /api/v1/rides?status=upcoming&limit=20` — upcoming rides list
- `GET /api/v1/riders?period=all&limit=50` — leaderboard
- `GET /api/v1/guidelines`
- `GET /api/v1/badges`
- Their own avatar + the upcoming rides' posters via `Image.prefetch`

A `useEnsurePrefetched()` hook in `_layout.tsx` fires these on auth transition. Tied to TanStack Query, so they just become normal cache entries — no separate persistence layer.

### B.9 Acceptance (Phase B done when…)

- App relaunched in airplane mode shows: home with cached upcoming rides, profile with real data, rider's garage and badges.
- Tap "Register for this ride" while offline → optimistic "queued" UI → reconnect → registration confirmed.
- Live ride started online, network dropped mid-ride → GPS keeps logging → reconnect → all breadcrumbs appear on the map for everyone in the session.
- App killed during a live ride → relaunch in airplane mode → app prompts to resume → GPS keeps logging.

---

## 4. Phase C — Cleanup, polish, production readiness (target: 2–3 days)

Smaller, parallel tracks.

### C.1 Activity-log writes from new v1 admin endpoints

The new mobile-driven admin actions (`/api/v1/admin/users/:id/approve`, `/admin/registrations/:regId`, `/admin/rides/*`, etc.) don't write `ActivityLog` rows yet — so a mobile-driven change is invisible in the audit feed. Plan to add a small `recordActivity()` helper invoked from each route after the mutation succeeds.

### C.2 Error boundaries

Wrap each top-level route in a `<RouteErrorBoundary>` that:
- Catches render errors
- Reports to Sentry with breadcrumb context
- Shows a "Something went wrong, restart the app" screen with a "Send report" button

### C.3 Loading skeletons + empty states

Replace `ActivityIndicator` with `<RideCardSkeleton />` etc. for the major lists (Rides, Arena, Blogs, Garage). Every list has a meaningful empty state with a CTA where possible.

### C.4 A11y pass

- Add `accessibilityLabel` / `accessibilityRole` to buttons and tappable rows.
- Run the iOS Simulator Accessibility Inspector to catch missing labels.
- Targets at least the rider golden path (login → ride list → ride detail → live).

### C.5 Performance

- Confirm `FlatList`s use `keyExtractor`, `getItemLayout` where possible.
- Cap remote image sizes — payment screenshots, in particular, can be 5 MB.
- One-shot bundle size audit via `npx expo export` + `du -sh`.

### C.6 Logging

- Replace stray `console.warn` with `Sentry.captureMessage(level="warning", …)`.
- In production builds, strip `console.log` via `babel-plugin-transform-remove-console`.

### C.7 Backend tests for `/api/v1`

Vitest suites covering at minimum:
- `/api/v1/auth/login` happy + bad password + reuse-detected refresh
- `/api/v1/rides/:id/register` capacity guard, tier guard, idempotent retry
- `/api/v1/rides/:id/live/location` batch acceptance + rejected validation
- `/api/v1/admin/registrations/:regId` push trigger only on actual transition
- `/api/v1/admin/activity-log/:id/rollback` supported actions + idempotency

### C.8 Mobile unit tests

- `outbox/store.ts` — enqueue/peek/ack/fail under racy reads
- `live/queue.ts` — append/drop semantics
- `live/tracker.ts` — `flushOnce` is single-flight under concurrent calls
- API client: refresh-token rotation, one-shot 401 retry

### C.9 Strip dev placeholders

- Replace `REPLACE_WITH_*` strings or make them opt-out warnings.
- Add a "Personal build" pill in the Profile screen when the bundle id starts with `com.t2w.sideload` so you don't ship one accidentally.

### C.10 Acceptance (Phase C done when…)

- A rider-level crash in production gets to Sentry with breadcrumbs.
- Every list either shows data, a skeleton, or a meaningful empty state.
- `vitest run` passes with new suites > 70% line coverage on the v1 routes.

---

## 5. Phase D — Optional follow-ups (after sideload + offline are solid)

Out of scope for "get it on my phone clean" but called out so we don't lose them:

- Map tile offline option B (pre-download `UrlTile` to FS) or C (MapLibre migration).
- Move to **TestFlight** when you want to share with 2+ riders — that's a different signing path + ~1 day of work + Apple Developer enrollment.
- Universal Links (`apple-app-site-association` from the Next.js backend at `/.well-known/`) once you're paid Apple Dev.
- FCM/APNs push for actual remote notifications.
- Tablet layouts for `ParticipationMatrix` and the admin tables.
- Localisation (Hindi, Kannada).
- Apple Watch / Wear OS companion.

---

## 6. Execution order (concrete sequence)

Each chunk is a single PR-sized commit:

1. **A.1–A.3** — `expo prebuild`, `app.config.ts` for personal variant, assets.
2. **A.4–A.5** — `SIDELOAD.md` walkthrough, push/Sentry guards for personal builds. Sideload-ready milestone.
3. **B.1** — Wire `PersistQueryClientProvider` + verify cached UI on relaunch.
4. **B.2** — `useIsOffline()` + `<OfflineBanner />`.
5. **B.4** — Auth client distinguishes network vs auth errors.
6. **B.3** — Outbox infrastructure (store, flusher, handlers).
7. **B.3 (cont.)** — Migrate the 8 critical mutations to outbox.
8. **B.5** — Live ride hardening (partial-flush handling, kill-recovery prompt, BG App Refresh check).
9. **B.7–B.8** — Image prefetch + `useEnsurePrefetched()`.
10. **B.6** — Polyline-only fallback when offline, document tile cache as a follow-up.
11. **C.1** — `ActivityLog` writes from v1 admin endpoints.
12. **C.2–C.4** — Error boundaries, skeletons, empty states, a11y.
13. **C.7–C.8** — Backend Vitest + mobile unit tests.
14. **C.5–C.6, C.9** — Final polish, bundle audit, dev-placeholder strip.

---

## 7. Out of scope (explicitly)

So this plan doesn't quietly grow:

- **Remote push** — needs paid Apple Dev. We keep the code paths working but no APNs/FCM cert until then.
- **Universal Links** — same reason.
- **App Store submission** — different track entirely.
- **Ride CRUD on mobile beyond the slim form already shipped** — wider regFormSettings/poster upload stays on the web.
- **Scheduled email management** — web-only.
- **Tablet layouts**.
- **Localisation**.

---

*End of plan. Once you say "go", we start at A.1.*
