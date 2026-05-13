# T2W Mobile Apps — Android & iOS Plan

**Status:** Proposal — pre-implementation
**Owner:** Engineering
**Last updated:** 2026-05-13
**Target stores:** Google Play, Apple App Store
**Repo branch (planning):** `claude/plan-mobile-apps-NWYpm`

---

## 1. Why we're building mobile apps

The T2W web app already covers the full lifecycle of a ride — registration, live GPS tracking, post-ride share cards, leaderboard, blogs, admin moderation. But the parts that matter most while actually riding are mobile-by-nature:

- **Live ride tracking** depends on reliable background GPS, which web browsers can't deliver on iOS (no Background Geolocation API in Safari) and only partially on Android.
- **Push notifications** for ride approvals, reminders, and live-ride break alerts are unreliable as web pushes on iOS Safari and easy to lose on Android Chrome.
- **Camera + share** flows (ride posts, blog covers, share cards) are slow over the mobile web compared with native sheet/share APIs.
- **App-store presence** signals legitimacy to non-technical riders and gives us a stable install surface.

A PWA already exists (Service Worker + `location-queue.ts`); we keep it, but it stops being the canonical mobile experience.

---

## 2. Decisions (locked)

| Decision | Choice | Rationale |
|---|---|---|
| Framework | **React Native + Expo (SDK 53+, EAS Build)** | Reuses React 19 / TypeScript skills, one codebase, mature libs for GPS / maps / push, OTA updates via EAS Update. |
| v1 scope | **Full feature parity with web** (incl. admin) | Same audience as web; avoids "two truths" for admins. Phased, not big-bang. |
| Backend strategy | **Versioned `/api/v1` mobile namespace** alongside existing routes | Web routes stay stable; mobile gets bearer-token auth, smaller payloads, cursor pagination, mobile-shaped errors. |
| Distribution | Google Play (closed → open testing → production), App Store (TestFlight → production) | Standard rollout. EAS Submit handles both. |

---

## 3. Architecture overview

```
┌────────────────────────────┐         ┌──────────────────────────────────────┐
│  iOS app (Expo / RN)       │         │  Next.js 16 backend on Vercel        │
│  Android app (Expo / RN)   │ ─HTTPS─▶│                                      │
│  Web (existing Next.js)    │         │  /api/*      (web — cookie auth)     │
│                            │         │  /api/v1/*   (mobile — bearer auth)  │
└──────────┬─────────────────┘         │                                      │
           │                           │  Prisma → Neon Postgres              │
           │ FCM / APNs                │  Vercel Blob (images)                │
           └─────────────────────────▶│  Vercel KV (OTP, rate limit, jobs)   │
                                      │  Cron: send-scheduled-emails, push   │
                                      └──────────────────────────────────────┘
```

Single backend, single database. Mobile is a new client — not a new system.

---

## 4. Mobile tech stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Expo SDK 53+, React Native 0.76+ (New Architecture / Fabric) | Custom dev client (not Expo Go) so we can use background GPS and FCM. |
| Language | TypeScript 5.9 (match web) | Shared types via internal package (see §7). |
| Navigation | `expo-router` (file-based) | Mirrors Next.js App Router conventions; easy mental model for the team. |
| State / data | TanStack Query v5 + Zustand | Query for server state, Zustand for ephemeral UI state. |
| Auth | `expo-secure-store` for refresh token; in-memory access token | See §6. |
| Forms | `react-hook-form` + `zod` (shared schemas) | Reuse zod schemas from web where they exist; introduce where they don't. |
| Maps | `react-native-maps` (Google on both platforms) | Matches web's Google Maps usage; reuse API key with platform restrictions. |
| GPS | `expo-location` + `expo-task-manager` for background tracking | iOS: `UIBackgroundModes=location`. Android: foreground service notification. |
| Local storage | `expo-sqlite` for breadcrumb queue, `@react-native-async-storage/async-storage` for prefs | Replaces the web Service Worker queue. |
| Push | `expo-notifications` → FCM (Android) + APNs (iOS) | Server keeps device tokens per user. |
| Camera / media | `expo-image-picker`, `expo-camera`, `expo-image-manipulator` | For ride posters, blog covers, share card source images. |
| Sharing | `expo-sharing`, `react-native-view-shot` | View-shot to render the 1080×1920 share card natively. |
| Deep links | `expo-linking` with universal/app links | `taleson2wheels.com/ride/{id}` opens app if installed. |
| Crash / perf | Sentry (`@sentry/react-native`) | Same Sentry org as web. |
| Analytics | Vercel Speed Insights replacement: PostHog or Amplitude (TBD) | Web uses Speed Insights, not user analytics — fresh decision for mobile. |
| Animations | `react-native-reanimated` v3 + `moti` | Closest to Framer Motion's developer ergonomics. |
| Icons | `lucide-react-native` | Matches web (`lucide-react`). |
| QR | `react-native-qrcode-svg` | Matches web's UPI QR rendering. |
| Testing | Jest + React Native Testing Library; Maestro for E2E | k6 stays for load. |
| Builds | EAS Build (managed credentials) | One config for dev / preview / production. |
| OTA | EAS Update | JS-only updates without store review. |

---

## 5. Backend changes — `/api/v1` mobile namespace

We do **not** rewrite or extract the backend. We add a thin parallel route tree under `src/app/api/v1/` that:

1. **Authenticates via `Authorization: Bearer <jwt>`** instead of the `t2w-token` cookie.
2. **Returns JSON-only** (no HTML redirects on auth failure; always 401 with a stable error shape).
3. **Uses cursor pagination** (`?cursor=…&limit=…`) instead of full-list returns.
4. **Trims payloads** to what mobile actually needs (e.g. no inlined large HTML blocks; markdown only).
5. **Uses a stable error envelope** — `{ "error": { "code": "RIDE_FULL", "message": "...", "details": {} } }`.

### Routes to add (v1 of v1)

```
/api/v1/auth/login                 POST   email + password → { accessToken, refreshToken, user }
/api/v1/auth/refresh               POST   refreshToken → { accessToken, refreshToken }
/api/v1/auth/logout                POST   revokes refresh token
/api/v1/auth/register              POST   same body as web /register
/api/v1/auth/send-otp              POST   email → 204
/api/v1/auth/verify-otp            POST   email + code → 204
/api/v1/auth/send-reset-otp        POST
/api/v1/auth/verify-reset-otp      POST
/api/v1/auth/reset-password        POST
/api/v1/auth/me                    GET    bearer → current user

/api/v1/devices                    POST   register FCM/APNs token { token, platform, deviceId }
/api/v1/devices/:id                DELETE deregister

/api/v1/rides                      GET    list (cursor)
/api/v1/rides/:id                  GET    detail
/api/v1/rides/:id/register         POST
/api/v1/rides/:id/registrations    GET    (admin/core)
/api/v1/rides/:id/live             GET / POST / PATCH
/api/v1/rides/:id/live/join        POST
/api/v1/rides/:id/live/location    POST   batch upload: { points: [{lat,lng,speed,heading,accuracy,ts}] }
/api/v1/rides/:id/live/break       POST / PATCH
/api/v1/rides/:id/live/metrics     GET

/api/v1/riders                     GET    leaderboard (period)
/api/v1/riders/:id                 GET    profile
/api/v1/motorcycles                GET / POST
/api/v1/motorcycles/:id            GET / PATCH / DELETE
/api/v1/badges                     GET
/api/v1/achievements               GET
/api/v1/blogs                      GET / POST
/api/v1/blogs/:id                  GET / PATCH / DELETE
/api/v1/ride-posts                 GET / POST
/api/v1/ride-posts/:id             GET / PATCH / DELETE
/api/v1/notifications              GET
/api/v1/notifications/:id/read     POST

/api/v1/guidelines                 GET
/api/v1/crew                       GET
/api/v1/stats                      GET
/api/v1/contact                    POST
/api/v1/upload                     POST   multipart → Vercel Blob URL
/api/v1/health                     GET

// Admin (Phase 2)
/api/v1/admin/users                GET
/api/v1/admin/users/bulk-approve   POST
/api/v1/admin/users/bulk-delete    POST
/api/v1/admin/users/:id/role       PATCH
/api/v1/admin/rides                POST / PATCH / DELETE
/api/v1/admin/activity-log         GET
/api/v1/admin/site-settings        GET / PATCH
/api/v1/admin/content              GET / POST / PATCH / DELETE
/api/v1/admin/badges               POST / PATCH / DELETE
/api/v1/admin/scheduled-emails     GET
```

### Shared internals to refactor (not rewrite)

These get extracted into `src/lib/api/handlers/` so both `/api/*` (web) and `/api/v1/*` (mobile) call the same business logic — the routes only differ in auth, shape, and pagination:

- `src/lib/api/handlers/rides.ts` — list / create / register / live session
- `src/lib/api/handlers/auth.ts` — login, OTP, reset
- `src/lib/api/handlers/riders.ts` — leaderboard, profile, dedup
- `src/lib/api/handlers/admin.ts` — bulk approve/delete, role changes, activity log

This is a low-risk refactor — web routes become thin wrappers that read the cookie, call the handler, and return.

### Middleware updates

`src/middleware.ts` currently does HTTPS redirect, bad-UA blocking, attack-pattern detection, and rate limiting — all of which apply to `/api/v1` too. The only change needed:

- Rate limit `/api/v1/auth/*` with the same KV-backed limiter as `/api/auth/*`.
- Skip the cookie-based session check for `/api/v1/*` (they're bearer-only).

---

## 6. Auth & session model on mobile

Cookies are clumsy on mobile — we switch to **bearer access tokens + refresh tokens**, while keeping the existing JWT signing infra (`jose`, `JWT_SECRET`).

| Token | Lifetime | Storage on device | Purpose |
|---|---|---|---|
| Access token (JWT) | 15 min | In-memory (TanStack Query auth header) | Sent as `Authorization: Bearer …` |
| Refresh token (opaque, random 32 bytes) | 60 days, rolling | `expo-secure-store` (Keychain / Keystore) | Exchanged at `/api/v1/auth/refresh` |

New Prisma model:

```prisma
model RefreshToken {
  id          String   @id @default(cuid())
  userId      String
  tokenHash   String   @unique           // SHA-256 of the opaque token
  deviceId    String?                    // for "log out other devices"
  platform    String?                    // ios | android
  expiresAt   DateTime
  revokedAt   DateTime?
  rotatedToId String?                    // chained refresh — detect token reuse
  createdAt   DateTime @default(now())
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
  @@index([expiresAt])
}

model DeviceToken {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique             // FCM or APNs token
  platform  String                       // ios | android
  deviceId  String                       // device-stable UUID
  appBuild  String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([userId, deviceId])
}
```

Rotating refresh tokens with reuse detection (if the same refresh token is presented twice, all tokens for that user are revoked).

Web continues using the cookie flow — no change required.

---

## 7. Repo / project structure

Two options were considered. We go with **monorepo (option A)** for shared types and zod schemas.

### Option A — monorepo with `pnpm` workspaces (chosen)

```
T2W/
├── apps/
│   ├── web/                # current Next.js app (moved from repo root)
│   └── mobile/             # new Expo app
├── packages/
│   ├── shared/             # zod schemas, TypeScript types, role-permissions
│   ├── api-client/         # generated typed client for /api/v1
│   └── ui-tokens/          # design tokens (colors, spacing) shared web ↔ mobile
├── prisma/                 # unchanged
├── scripts/                # unchanged
└── pnpm-workspace.yaml
```

The repo-root move is done in a single migration commit. CI, Vercel build settings (`buildCommand: "pnpm --filter web build"`), Playwright paths, and Sentry release configs are updated in the same commit. Estimated friction: ~1 day of unsticking imports and build configs.

### Option B — separate repo `t2w-mobile`

Cheaper to set up but forces us to either (a) duplicate types and zod schemas or (b) publish them to a private npm registry. Rejected on grounds of long-term cost.

---

## 8. Feature parity mapping (web → mobile)

Legend: ✅ ship in same phase · 🟡 Phase 2 · 🔴 Phase 3 (admin parity)

| Web area | Mobile equivalent | Phase | Notes |
|---|---|---|---|
| Login / register / OTP / reset | Same flows, native keyboards, OTP autofill | ✅ 1 | iOS reads OTP from SMS automatically; Android via SMS Retriever where viable. |
| Home (NotificationBoard, UpcomingRides, Hero) | Tabbed home: Feed · Rides · Live · Garage · More | ✅ 1 | Replace marketing hero on mobile — riders skip it. |
| Rides list / detail | Native list + detail screen | ✅ 1 | Pull-to-refresh, share sheet. |
| Ride registration form (with per-ride field overrides + UPI QR) | Native form, embedded QR | ✅ 1 | Payment proof upload via camera roll / camera. |
| **Live ride tracking** | **Background-GPS native; offline-safe queue** | ✅ 1 (mobile-first) | See §9. |
| Live map (Google Maps) | `react-native-maps` with same Google key | ✅ 1 | Custom break markers, lead-rider toggle. |
| Post-ride summary + ShareableRideCard | `react-native-view-shot` to render 1080×1920 PNG, then share sheet | ✅ 1 | Native sheet beats the Web Share API. |
| Profile / garage (Motorcycle CRUD) | Native screens | ✅ 1 | |
| Leaderboard + filter (6m / 1y / all) | Native list with segmented control | ✅ 1 | |
| Badges / achievements | Native grid, animated unlock on award | ✅ 1 | |
| Blogs list / detail / create | Native; markdown rendering with `react-native-markdown-display` | 🟡 2 | Drafts stored locally before submit. |
| Ride posts (photo posts with moderation) | Native multi-photo picker + upload | 🟡 2 | |
| Notifications | Native push (FCM/APNs) + in-app notification center | ✅ 1 | Tap deep-links to the ride / blog. |
| Guidelines | Native screen | ✅ 1 | Offline-cached. |
| Crew page | Native screen | 🟡 2 | |
| Contact form | Native form | 🟡 2 | |
| Admin: user approval queue + bulk approve/delete | Native admin tab (visible only to core+) | 🔴 3 | |
| Admin: role management | Native role-changer | 🔴 3 | |
| Admin: ride CRUD + poster upload | Native form + image picker | 🔴 3 | |
| Admin: participation matrix | Stripped-down mobile-friendly variant (grid is too wide for phone) | 🔴 3 | Defer full matrix to tablet/landscape. |
| Admin: blog / ride-post moderation | Native moderation queue | 🔴 3 | |
| Admin: activity log + rollback | Native list with rollback action | 🔴 3 | |
| Admin: site settings (form fields, email templates, UPI) | Tablet-only on iPad / large Android; phone shows read-only | 🔴 3 | UX honest about the form complexity. |
| Admin: scheduled emails | Native list, no editor (read-only) | 🔴 3 | |
| Service Worker location queue (web) | Replaced by `expo-task-manager` + SQLite queue | ✅ 1 | Web SW stays for the web app. |

---

## 9. Native-only capabilities (the reason we're building this)

### 9.1 Background GPS tracking

Why this is the headline feature: web can't do it on iOS. Implementation:

- `expo-location` + `expo-task-manager` registers a background task that fires every ~5 seconds (configurable) when the user is in an active ride session.
- iOS: `Info.plist` sets `UIBackgroundModes = ["location", "fetch", "processing"]` and `NSLocationAlwaysAndWhenInUseUsageDescription`. We display a clear pre-prompt explaining *why* before the system dialog (iOS rejects vague justifications).
- Android: foreground service with a persistent notification ("T2W is tracking your ride"). Set `ACCESS_BACKGROUND_LOCATION` only if Android 10+. Battery-optimisation exemption requested with an in-app explainer.
- Breadcrumbs are written to a local SQLite table, then flushed in batches of 50 to `POST /api/v1/rides/:id/live/location`.
- Same path-decimation logic as web — server-side, so we don't trust the client. The existing live ride decimation in the backend covers this; no change.
- A "low-power" mode reduces sampling to 30 s on long expeditions (Ladakh, Nepal) where battery matters more than precision.

### 9.2 Push notifications

- Token registered at app launch (after auth) via `POST /api/v1/devices`.
- Triggered on: registration approved/rejected, ride starting in 1 hour, live ride break exceeds 30 minutes (admin alert), blog/ride-post approved, role change.
- Plumbing: a small `src/lib/push.ts` server module wraps Firebase Admin SDK (FCM v1) and node-apn — both can hit Vercel cold starts; we keep payloads small.
- Triggered from the same code paths that already call `Notification.create` in Prisma — we attach a `pushDispatched` field to avoid duplicates.

### 9.3 Deep links / universal links

- `taleson2wheels.com/ride/:id` opens the app if installed (`apple-app-site-association` + Android `assetlinks.json` served from `/.well-known/`).
- Tapping a push opens directly to the right screen (ride, blog, profile, notification).

### 9.4 Offline-first ride flows

- Guidelines, crew list, user's own profile, garage, badges — cached on device with TanStack Query persistence (`@tanstack/query-async-storage-persister`).
- Active live ride continues writing GPS to local SQLite when offline; flush retries with exponential backoff.

### 9.5 Camera and share

- Ride posts and blog covers: `expo-image-picker` (multi-select for ride posts).
- Share card: `react-native-view-shot` renders an offscreen native view at 1080×1920 and `expo-sharing` opens the share sheet (WhatsApp, Instagram, Files).
- Payment-proof upload during registration: camera-first, gallery fallback.

---

## 10. Build, release & store strategy

### 10.1 Environments

| Env | API URL | Distribution | Notes |
|---|---|---|---|
| `development` | Local Next.js (`expo-tunnel`) | Custom dev client locally | Background GPS testable. |
| `preview` | Vercel preview branch URL | EAS internal distribution | Per-PR builds for QA. |
| `staging` | `staging.taleson2wheels.com` | TestFlight + Play closed track | Pre-prod data parity. |
| `production` | `taleson2wheels.com` | App Store + Play production | OTA via EAS Update for JS-only fixes. |

### 10.2 EAS configuration (`eas.json` sketch)

```jsonc
{
  "build": {
    "development": { "developmentClient": true, "distribution": "internal" },
    "preview":     { "distribution": "internal", "channel": "preview" },
    "staging":     { "channel": "staging" },
    "production":  { "channel": "production", "autoIncrement": true }
  },
  "submit": {
    "production": {
      "ios":     { "appleId": "...", "ascAppId": "...", "appleTeamId": "..." },
      "android": { "serviceAccountKeyPath": "./secrets/play-service.json", "track": "internal" }
    }
  }
}
```

Secrets live in EAS Secrets (per-env), never in the repo.

### 10.3 Store assets / metadata

- App name: **Tales on 2 Wheels**
- Bundle IDs: `com.taleson2wheels.app` (iOS), `com.taleson2wheels.app` (Android)
- Categories: Sports / Lifestyle (primary), Travel (secondary)
- Privacy nutrition labels: precise location (background), photos (camera roll), email, phone, contacts (emergency contact field). All declared in `app.config.ts` and matched by App Privacy on App Store Connect / Play Data Safety.
- Permissions copy is reviewed by Core Member group before submission (community trust matters more than launch speed).
- Screenshots: 5 per platform — Live ride map, ride detail, leaderboard, share card, profile.

### 10.4 Compliance gotchas

| Issue | Mitigation |
|---|---|
| iOS background location justification | Pre-prompt explainer screen before the system dialog; explicit "only during active ride" wording in App Privacy. |
| Apple in-app purchases vs ride fees | T2W ride fees are physical-event payments via UPI → **exempt from IAP**. We add this rationale to the App Review notes proactively; otherwise rejection is likely. |
| Google Play foreground service declaration | Submit `Health & Fitness` foreground service type with declaration form; expect ~3 day review. |
| Data Safety / Privacy form accuracy | Inventory in `docs/mobile-data-collected.md` (TBD) lists every field — kept in sync with `prisma/schema.prisma`. |
| Children's data | App is 13+; not a kids app. No COPPA/IAA concerns. |
| Indian DPDP Act | Privacy policy on `taleson2wheels.com/privacy` must specifically call out location tracking, emergency contact retention, and rider's right to data export. |

---

## 11. CI/CD

- **Web (unchanged):** Vercel preview deploys per PR.
- **Mobile:**
  - GitHub Actions: on PR → typecheck, lint, `jest`, `maestro` smoke (Maestro Cloud).
  - On merge to `main` → `eas build --profile preview --platform all` (internal distribution).
  - On tag `mobile-v*` → `eas build --profile production --platform all` then `eas submit`.
  - OTA: on patch-tag (`mobile-v1.2.3-ota`) → `eas update --channel production` (JS-only; native-binary changes still need a real build).

Vercel cron, web E2E (Playwright), and k6 stay as they are.

---

## 12. Testing strategy

| Layer | Tool | Scope |
|---|---|---|
| Unit | Jest + React Native Testing Library | Components, hooks, zod schemas, reducers. |
| Integration | MSW for the API client | Verify the typed `api-client` package against fixture responses. |
| E2E (mobile) | Maestro | Login → register for ride → join live ride → submit a breadcrumb → end ride → render share card. ~10 flows. |
| Manual device matrix | Real-device QA on iPhone 13/15, Pixel 6, Samsung A-series, OnePlus | Background GPS varies wildly by OEM; emulator can't validate this. |
| Backend (`/api/v1`) | Vitest with new test suites in `src/__tests__/api/v1/` | Auth (bearer + refresh rotation + reuse detection), rate limit, cursor pagination. |
| Load | k6 (existing) | Add a `mobile-live-tracking.js` scenario simulating 50 concurrent riders posting batches of 50 points every 30 s. |
| Security | Reuse `npm run security-review`-style checks (see `SECURITY.md`); add OWASP MASVS L1 self-audit before launch. | |

---

## 13. Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| iOS background location rejection at App Review | Medium | High (1–2 week delay) | Pre-prompt screen, clear App Privacy answers, App Review notes with the use case and a demo video. |
| Android OEM battery killers (Xiaomi, OnePlus, Samsung) stopping the foreground service | High | High | In-app battery-optimisation explainer per OEM; document workarounds (`docs/runbooks/android-battery.md`); fall back to PWA Service Worker queue isn't viable, so accept that some devices lose breadcrumbs and reconstruct via post-ride GPX import (already supported on the backend via `RideGpxAttachment`). |
| `/api/v1` divergence — bug fixes land in `/api/*` but not `/api/v1/*` | High | Medium | Force both to call shared handlers in `src/lib/api/handlers/` (see §5). New API logic *must* be added to a handler, not a route. Lint rule enforces it. |
| Refresh-token replay if device is compromised | Low | Medium | Rotating refresh tokens with reuse detection (revokes all sessions on reuse). Per-device tokens so users can log out a single device. |
| App store account ownership (Apple Developer / Play Console) | Medium | High | Set up under a T2W org account, not a personal one. Two admin owners (Super Admin role) to avoid bus factor. |
| Map cost: Google Maps mobile + web on same key | Medium | Low | Add iOS/Android bundle restrictions on the key. Monitor MAU vs free tier. Budget alert at $50/month. |
| Push provider lock-in (FCM/APNs) | Low | Low | Wrap in `src/lib/push.ts` so we can swap to Expo Push or OneSignal later. |
| Admin parity (Phase 3) slipping indefinitely | Medium | Low | Core admins keep using the web; mobile admin is a convenience, not a blocker for v1. |

---

## 14. Phased delivery & timeline

Estimates assume **1 mobile engineer + 0.5 backend engineer + 0.25 design + 0.25 QA**. Multi-team would compress.

### Phase 0 — Foundations (2 weeks)

- Monorepo migration with pnpm workspaces (move `T2W/` → `apps/web/`, set up `packages/shared`, `packages/api-client`).
- Scaffold `apps/mobile` with Expo SDK 53, expo-router, TanStack Query, Sentry, EAS config.
- Add `RefreshToken` and `DeviceToken` Prisma models + migrations (no behaviour change on web).
- Refactor `/api/auth/*` and `/api/rides/*` into `src/lib/api/handlers/` (no behaviour change).
- Ship `/api/v1/health` + `/api/v1/auth/*` only. Document in `docs/api-v1.md`.

**Exit criteria:** mobile dev client builds, can log in, sees `/api/v1/auth/me` response.

### Phase 1 — Rider MVP (6 weeks)

- Auth (login / register / OTP / reset), navigation shell, home tabs.
- Rides list / detail / register.
- Live ride tracking with background GPS, breaks, metrics, map, end-ride flow.
- Share card.
- Profile / garage / leaderboard / badges / guidelines.
- Push notifications (registration approved, ride reminder).
- `/api/v1` routes for everything above.
- Beta release to TestFlight + Play closed track (10–20 riders).

**Exit criteria:** A real T2W rider can do an entire ride end-to-end on the app (registration → live tracking → share card) without touching the web.

### Phase 2 — Community (4 weeks)

- Blogs (read, create, like).
- Ride posts (multi-photo upload).
- Crew page, contact form.
- Notifications center.
- App Store + Play production submission.

**Exit criteria:** Apps publicly listed. PWA banner on the web points at the apps.

### Phase 3 — Admin parity (4 weeks)

- User approval queue, role management.
- Ride CRUD, registration moderation.
- Blog / ride-post moderation.
- Activity log (read + rollback).
- Site settings (read-only on phone, editable on tablet).

**Exit criteria:** A Super Admin can run the next group ride entirely from a phone.

### Phase 4 — Polish (ongoing)

- Tablet layouts for participation matrix.
- iPad share extension (share photo into T2W as a ride post).
- Apple Watch / Wear OS companion (ride metrics on wrist) — *non-committal*.
- Localisation (English → Hindi, Kannada).

**Total to feature-complete mobile parity:** ~16 weeks.

---

## 15. Open questions

These need a decision before Phase 0 starts; tracking each is cheap, deferring them isn't.

1. **App-store account ownership** — under whose Apple Developer / Play Console accounts? Org accounts strongly preferred.
2. **Analytics tool** — PostHog (self-host option, generous free tier) vs Amplitude vs none. Default: PostHog.
3. **Push provider** — Expo Push Service (free, simple) vs direct FCM + APNs (more control, more work). Default: Expo Push for v1, swap if it bottlenecks.
4. **Map provider on mobile** — confirm Google Maps (matches web) vs Mapbox (`mapbox-gl` is already a dependency on web, though unclear if actively used). Audit `mapbox-gl` usage first.
5. **Sentry budget** — current Sentry plan's event quota with a mobile app added.
6. **Privacy policy update** — counsel review for DPDP + Apple/Google privacy disclosures before submission.
7. **Versioning policy** — semver for the apps; do we couple to backend `/api/v1` minor versions or keep independent? Default: independent, with a `minBackendVersion` check at launch.

---

## 16. Appendix — what doesn't change

A non-exhaustive list of things that stay exactly as they are. Keeping it visible reduces scope creep:

- The Next.js web app at `taleson2wheels.com` continues to work and serve all current users.
- The existing cookie-based `/api/*` routes are not removed and not deprecated.
- Prisma schema additions are purely additive (`RefreshToken`, `DeviceToken`); existing tables are untouched.
- Service Worker (`ServiceWorkerRegistrar.tsx`, `location-queue.ts`) keeps doing its job for web users on Android Chrome.
- Vercel cron, Sentry org, Neon, Vercel Blob, Vercel KV — same setup, no migration.
- Admin web dashboard remains the primary admin surface; mobile admin (Phase 3) is a convenience layer.

---

*End of plan. Reviewers: please leave comments inline or in the PR thread on the planning branch.*
