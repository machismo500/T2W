# Tales on 2 Wheels (T2W)

**India's motorcycle riding community platform** — organizing, managing, and celebrating group rides across India since March 2024.

Built for the T2W brotherhood of 500+ riders based in Bangalore, Karnataka. From weekend getaways to multi-week expeditions through Ladakh, Nepal, and Thailand.

**Live:** [taleson2wheels.com](https://taleson2wheels.com)

---

## Table of Contents

- [Features](#features)
- [Roles & Permissions](#roles--permissions)
- [Tech Stack](#tech-stack)
- [Architecture & Data Models](#architecture--data-models)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [NPM Scripts](#npm-scripts)
- [Testing](#testing)
- [Deployment Plan](#deployment-plan)
- [Security](#security)
- [Contributing](#contributing)

---

## Features

### Authentication & Account Management
- Email + password sign-up with bcrypt password hashing
- OTP-based email verification on registration (`/api/auth/send-otp`, `/api/auth/verify-otp`)
- OTP-based password reset flow (`/api/auth/send-reset-otp`, `/api/auth/verify-reset-otp`, `/api/auth/reset-password`)
- JWT session tokens (jose) issued at login, validated by middleware on protected routes
- Current-user endpoint (`/api/auth/me`) for client hydration

### Rides
- Create, edit, delete rides with poster image, route, fee, leader/sweep crew, difficulty
- Customisable per-ride registration form fields (override global form settings)
- Tiered registration windows — open registration to Core, T2W Rider, and Rider/Guest tiers at staggered times
- Ride registration capturing accommodation choice, blood group, emergency contact, and payment proof
- UPI ID + QR code rendered in registration form (global default with per-ride override)
- Admin approval / rejection of registrations, with bulk admin-manage endpoint
- Ride reminders (`/api/rides/[id]/notify-reminder`)
- CSV export of registrations

### Live Ride Tracking
- Active live-ride session per ride (`/api/rides/[id]/live`)
- Rider self-join into live session (`/api/rides/[id]/live/join`)
- GPS breadcrumb submission (lat, lng, speed, heading, accuracy) (`/api/rides/[id]/live/location`)
- Planned-route storage on the session for off-route deviation detection
- Break management — log start/end/reason for rest stops (`/api/rides/[id]/live/break`)
- Aggregate session metrics — average speed, cumulative distance, active rider count (`/api/rides/[id]/live/metrics`)
- Map view with current locations, headings, and break markers
- Service Worker registration for offline-friendly location queueing (`src/components/ServiceWorkerRegistrar.tsx`, `src/lib/location-queue.ts`)

### Rider Profiles & Leaderboard
- Public rider directory (`/rider`) with stats: total km, rides completed, badges
- Individual profile pages (`/rider/[id]`) with motorcycle garage, participation history, badges earned
- Leaderboard with period filter (`6m`, `1y`, `all`) (`/api/riders?period=…`)
- PII stripped for non-privileged viewers; full contact details only visible to co-riders / admins
- Rider search (admin) (`/api/riders/search`)
- Profile deduplication scan and merge (`/api/riders/dedup`, `/api/riders/merge`)
- Stats recalculation across all rides (`/api/riders/recalculate-stats`)
- User ↔ RiderProfile linkage check by email (`/api/riders/check-email`, `/api/riders/check-links`)
- Role sync from `User` → `RiderProfile` after bulk imports (`/api/riders/sync-roles`)
- Clear "dropped out" flag from participation records (`/api/riders/clear-dropouts`)

### Motorcycles (Garage)
- Per-user motorcycle collection — make, model, year, cc, colour, nickname, image
- Full CRUD via `/api/motorcycles` and `/api/motorcycles/[id]`

### Achievements & Badges
- Tiered badges by km threshold — `SILVER → GOLD → PLATINUM → DIAMOND → ACE → CONQUEROR`
- Auto-award on stats recalculation
- Badge CRUD (`/api/badges`); user-earned badges via `/api/achievements`

### Blogs
- Official and personal blog posts with cover image, tags, read time, optional vlog (video) link
- Approval workflow — user-submitted posts go pending until approved by Core Member or Super Admin
- Like counter, listing page (`/blogs`), detail page (`/blog/[id]`)

### Ride Posts (community photo posts)
- Ride-specific photo posts and reports (`/api/ride-posts`)
- Approval workflow with admin moderation (`/api/ride-posts/[id]`)

### Notifications & Scheduled Emails
- In-app notification feed (info / warning / success / ride types) (`/api/notifications`)
- Notification board on the homepage
- Outbound transactional email via Nodemailer (SMTP) — OTPs, password resets, contact form
- Scheduled batch emails (`ScheduledEmail` model + `/api/cron/send-scheduled-emails` cron) for staggered ride announcements per role tier

### Crew & Community
- Public crew page driven by Super Admin / Core Member roles (`/api/crew`)
- Riding guidelines (`/guidelines`) — formation, hand signals, T-CLOCS check, cornering, emergency protocol, fuel management (`/api/guidelines`)
- Contact form with email delivery (`/api/contact`)

### Admin Dashboard (`/admin`)
- User approval queue with bulk approve / bulk delete (`/api/users/bulk-approve`, `/api/users/bulk-delete`)
- Role management — change between Rider / T2W Rider / Core Member / Super Admin (`/api/users/role`)
- Per-user approve / reject (`/api/users/[id]/approve`, `/api/users/[id]/reject`)
- Ride CRUD with poster uploads
- Participation matrix for marking attendance and awarding points
- Profile deduplication and merging UI
- Blog and ride-post moderation
- Activity log with rollback support (`/api/activity-log`)
- Site Settings — global registration form fields, email templates, UPI configuration (`/api/site-settings`)
- Content management — Brand / Media / Document items (`/api/content`)
- Permissions tab driven by `src/lib/role-permissions.ts`

### Stats, SEO & Health
- Aggregate site stats — total rides, total km, active riders, completions (`/api/stats`)
- `robots.ts` and `sitemap.ts` for SEO (AI crawlers explicitly allow-listed for discoverability)
- Vercel Speed Insights integrated (`@vercel/speed-insights`)
- Health endpoint (`/api/health`)

### Uploads
- Image upload pipeline (`/api/upload`) for avatars, ride posters, blog covers, motorcycle photos
- Avatar sync from `RiderProfile` → `User` after linkage (`/api/upload/avatar-sync`)

---

## Roles & Permissions

| Role | Access |
|------|--------|
| **Super Admin** | Full access — user management, role changes, all CRUD, activity-log rollback |
| **Core Member** | Ride management, registration approvals, content/blog/ride-post moderation, admin dashboard |
| **T2W Rider** | Blog and ride-post creation (pending approval), ride registration with priority window |
| **Rider** | View rides, register, view own profile and garage |

Permission logic lives in `src/lib/role-permissions.ts` and is enforced both server-side (API routes) and client-side (`src/context/AuthContext.tsx`). Middleware (`src/middleware.ts`) gates routes based on JWT role claims.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 16](https://nextjs.org/) (App Router, React 19) |
| Language | TypeScript 5.9 |
| Database | PostgreSQL via [Neon](https://neon.tech/) (serverless) using `@neondatabase/serverless` + `@prisma/adapter-neon` |
| ORM | [Prisma 6](https://www.prisma.io/) |
| Styling | [Tailwind CSS 3](https://tailwindcss.com/) + PostCSS + Autoprefixer |
| Auth | JWT (jose) + bcryptjs |
| Animations | [Framer Motion](https://www.framer.com/motion/) |
| Email | Nodemailer (SMTP) + `@emailjs/browser` for client-side fallback |
| Maps | Google Maps JS SDK (live tracking) |
| QR | `react-qr-code` (UPI payment QR) |
| Icons | [Lucide React](https://lucide.dev/) |
| Hosting | [Vercel](https://vercel.com/) |
| Performance | Vercel Speed Insights |
| Testing | Vitest, Playwright, k6 |

---

## Architecture & Data Models

Key models in `prisma/schema.prisma`:

- **User** — Authentication account with role-based access
- **RiderProfile** — Master rider record with stats, avatar, emergency info (linked to User by email)
- **RideParticipation** — Actual participation tracking with awarded points
- **Motorcycle** — User's bikes (make, model, year, cc, nickname, image)
- **Badge / UserBadge** — Achievement tiers awarded by km milestones
- **Ride** — Group ride event with route, crew, poster, registration form config
- **RideRegistration** — Individual registrations with payment proof and emergency details
- **BlogPost** — Community blog entries with approval workflow
- **RidePost** — Ride-specific photo posts with moderation
- **Notification** — In-app notifications (global + per-user)
- **Otp** — Short-lived one-time passwords for email verification and password reset
- **Guideline** — Riding safety and group guidelines
- **LiveRideSession / LiveRideLocation / LiveRideBreak** — Real-time GPS tracking per ride
- **Content** — Admin-managed Brand / Media / Document items
- **ActivityLog** — Audit trail of admin actions with rollback payload
- **SiteSettings** — Key/value JSON store for global config (form fields, email templates, UPI)
- **ScheduledEmail** — Queued batch emails dispatched by the cron worker

---

## Project Structure

```
T2W/
├── src/
│   ├── app/
│   │   ├── api/                   # API route handlers (Next.js Route Handlers)
│   │   │   ├── auth/              # login, register, OTP, password reset, me, logout
│   │   │   ├── rides/             # ride CRUD + [id]/register, [id]/registrations, [id]/live/*
│   │   │   ├── riders/            # profiles, search, dedup, merge, participation, sync-roles
│   │   │   ├── users/             # user mgmt, role, bulk-approve, bulk-delete, [id]/approve|reject
│   │   │   ├── blogs/             # blog CRUD + approval
│   │   │   ├── ride-posts/        # ride photo posts + approval
│   │   │   ├── notifications/     # notification feed
│   │   │   ├── motorcycles/       # garage CRUD
│   │   │   ├── badges/            # badge definitions
│   │   │   ├── achievements/      # earned badges
│   │   │   ├── guidelines/        # riding guidelines
│   │   │   ├── content/           # brand / media / documents
│   │   │   ├── site-settings/     # global config JSON store
│   │   │   ├── activity-log/      # admin audit trail w/ rollback
│   │   │   ├── crew/              # public crew listing
│   │   │   ├── stats/             # aggregate site stats
│   │   │   ├── contact/           # public contact form
│   │   │   ├── upload/            # image upload + avatar-sync
│   │   │   ├── cron/              # send-scheduled-emails (Vercel cron)
│   │   │   └── health/            # uptime probe
│   │   ├── admin/                 # admin dashboard pages
│   │   ├── ride/[id]/             # ride detail + /live/ tracking page
│   │   ├── rider/[id]/            # rider profile pages
│   │   ├── blog/[id]/             # blog detail
│   │   ├── blogs/                 # blog listing
│   │   ├── dashboard/             # user dashboard
│   │   ├── guidelines/            # public guidelines page
│   │   ├── login/, register/      # auth pages
│   │   ├── robots.ts, sitemap.ts  # SEO
│   │   └── layout.tsx, page.tsx   # root + landing
│   ├── components/
│   │   ├── admin/                 # AdminPage, ParticipationMatrix, MergeProfiles, ArenaSettingsTab, …
│   │   ├── home/                  # Hero, About, UpcomingRides, NotificationBoard, HowToJoin
│   │   ├── rides/                 # RideDetailPage, LiveRidePage, LiveRideMap, LiveRideControls
│   │   ├── rider/                 # RiderProfilePage
│   │   ├── riders/                # ArenaLeaderboard, ArenaRiderCard, RiderArenaPage
│   │   ├── blogs/                 # BlogsPage, BlogDetailPage
│   │   ├── shared/                # LoginPage, RegisterPage, GuidelinesPage, PasswordStrength, UserMenu
│   │   ├── layout/                # Navbar, Footer
│   │   └── ServiceWorkerRegistrar.tsx
│   ├── lib/
│   │   ├── db.ts                  # Prisma client singleton (Neon adapter)
│   │   ├── auth.ts                # JWT helpers + getCurrentUser
│   │   ├── api.ts, api-client.ts  # Server / client API helpers
│   │   ├── email.ts               # Nodemailer SMTP wrapper
│   │   ├── otp-store.ts           # OTP issuance + verification
│   │   ├── geo-utils.ts           # Distance, bearing, deviation math
│   │   ├── location-queue.ts      # Offline-safe location buffering
│   │   ├── ride-status.ts         # Date/state machine for ride status
│   │   ├── role-permissions.ts    # Role → capability mapping
│   │   └── json-utils.ts          # Safe JSON helpers
│   ├── context/AuthContext.tsx    # Auth state + role-based permissions
│   ├── middleware.ts              # JWT route gating
│   ├── types/                     # TypeScript types
│   └── __tests__/                 # Vitest unit/integration suites
├── prisma/schema.prisma           # 20 models
├── scripts/                       # seed-admins, seed-rider-profiles, seed-badges, seed-blogs-guidelines
├── e2e/                           # Playwright specs (15 suites)
├── k6/performance.js              # Load test
├── public/                        # Static assets
├── vercel.json                    # Cron schedule, redirects, HSTS
├── next.config.ts                 # CSP, security headers, legacy-domain redirects
└── .github/workflows/             # deploy.yml (Vercel) + neon_workflow.yml (PR branches)
```

---

## Getting Started

### Prerequisites

- Node.js 20+ (CI uses 20; package supports 18+)
- PostgreSQL database — recommended: [Neon](https://neon.tech/) free tier
- SMTP credentials for transactional email (Gmail App Password works)

### Setup

```bash
git clone https://github.com/xploroshan/T2W.git
cd T2W

# Installing also runs Prisma generate + db push + 4 seed scripts via postinstall
npm install

cp .env.example .env
# Fill in DATABASE_URL, DATABASE_URL_UNPOOLED, JWT_SECRET, SMTP_*
```

### Database

```bash
npm run db:push        # push Prisma schema to Neon
npm run db:seed        # seed admins, rider profiles, badges
npm run db:studio      # visual DB browser
```

### Develop & Build

```bash
npm run dev            # dev server at http://localhost:3000
npm run build          # prisma generate + db push + next build
npm start              # production server
```

---

## Environment Variables

```env
# Neon Postgres — pooled (runtime)
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"
# Neon Postgres — direct (migrations)
DATABASE_URL_UNPOOLED="postgresql://user:pass@host/db?sslmode=require"

# JWT signing key
JWT_SECRET="your-strong-random-string"

# SMTP (Gmail example — use an App Password)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your@gmail.com"
SMTP_PASS="your-app-password"
SMTP_FROM="Tales on 2 Wheels"

# Google Maps JavaScript API — required for Live Ride tracking map
# Enable "Maps JavaScript API" in Google Cloud Console, restrict the key by
# HTTP referrer to your production + preview domains, and enable billing.
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="AIza…"
```

---

## NPM Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | `prisma generate` + `prisma db push` + `next build` |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm test` | Vitest watch mode |
| `npm run test:run` | Vitest single run |
| `npm run test:coverage` | Vitest with v8 coverage |
| `npm run db:push` | Push Prisma schema |
| `npm run db:migrate` | Create + apply Prisma migration |
| `npm run db:seed` | Seed admins, rider profiles, badges |
| `npm run db:reset` | Reset and re-seed |
| `npm run db:studio` | Open Prisma Studio |

The `postinstall` hook runs Prisma generate, `db push --accept-data-loss`, and **all four** seed scripts (admins, rider profiles, badges, blogs/guidelines). This is what bootstraps a fresh Vercel deployment.

---

## Testing

| Tool | Scope | Location |
|------|-------|----------|
| **Vitest** | Unit + integration tests for API routes, components, hooks, middleware, lib utilities | `src/__tests__/` |
| **Playwright** | End-to-end browser tests across auth, rides, registration, payment, accommodation, live tracking, leaderboard, admin, security, social sharing, notifications | `e2e/` (15 spec files) |
| **k6** | Load / performance benchmark | `k6/performance.js` |

```bash
npm run test:run                  # run all unit tests
npx playwright test               # run e2e suite (defaults to http://localhost:3001)
k6 run k6/performance.js          # load test
```

Vitest config (`vitest.config.ts`) uses `jsdom`, the React plugin, and v8 coverage scoped to `src/lib/`, `src/app/api/`, and `src/middleware.ts`.

---

## Deployment Plan

The application is deployed continuously to **Vercel** with **Neon Postgres** as the database. Three pipelines work together: GitHub Actions for production deploys, a Neon workflow for per-PR preview databases, and Vercel Cron for scheduled work.

### Hosting topology

- **Frontend / API:** Vercel (Next.js 16 runtime, edge-friendly handlers)
- **Database:** Neon serverless PostgreSQL (pooled connection at runtime, unpooled connection for migrations)
- **Domain:** `taleson2wheels.com` over HTTPS with HSTS preload
- **Image storage:** Base64 data URLs stored directly in Postgres rows (avatars, posters, blog covers)
- **Email:** SMTP via Nodemailer (Gmail in production)

### Production deploy pipeline (`.github/workflows/deploy.yml`)

Triggered on push to `main` or `master`, or manual dispatch:

1. Checkout repository
2. Setup Node.js 20 with npm cache
3. `npm ci`
4. `npx next build` with `DATABASE_URL` from secrets
5. Install Vercel CLI
6. `vercel deploy --prebuilt --prod` using `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`

Concurrency group `deploy` prevents overlapping production rollouts.

### Per-PR preview environments (`.github/workflows/neon_workflow.yml`)

For every PR:

- **On open / reopen / synchronize** → `neondatabase/create-branch-action` creates an isolated Neon database branch named `preview/pr-<num>-<branch>` and exposes pooled + unpooled connection strings to the workflow.
- **On close** → `neondatabase/delete-branch-action` deletes the branch.

This gives every PR a throwaway database mirroring production schema, so destructive migrations and seed changes can be tested in isolation.

### First-deploy bootstrap (the `postinstall` hook)

When Vercel runs `npm install`, the `postinstall` script in `package.json` performs:

```
prisma generate
prisma db push --accept-data-loss
tsx scripts/seed-admins.ts
tsx scripts/seed-rider-profiles.ts
tsx scripts/seed-badges.ts
tsx scripts/seed-blogs-guidelines.ts
```

This makes a cold deploy self-bootstrapping — schema is applied and admin/rider/badge/content seeds are populated before the first request.

> Caveat: `--accept-data-loss` is acceptable here because the project owns the Neon database and treats Prisma schema as source of truth. For environments where data must be preserved across schema drift, switch this to `prisma migrate deploy` and remove `--accept-data-loss`.

### Scheduled jobs (`vercel.json`)

```json
"crons": [{ "path": "/api/cron/send-scheduled-emails", "schedule": "* * * * *" }]
```

The cron handler reads pending `ScheduledEmail` rows, matches them to recipients (per role tier), and dispatches via Nodemailer. This powers staggered ride-announcement emails.

### Redirects

- `vercel.json` — HTTP → HTTPS, `www.taleson2wheels.com` → apex
- `next.config.ts` — `/home` → `/`, legacy `bangaloremotorcycleclub.com` (with and without `www`) → `taleson2wheels.com`

### Rollback strategy

- **Code:** revert via Vercel "Promote previous deployment" or push a revert commit to `main`.
- **Data:** admin actions write to `ActivityLog` with a JSON rollback payload, exposed via the admin Activity Log UI.
- **Schema:** when `db:migrate` is used, Prisma migration history allows targeted rollbacks against an unpooled connection.

### Manual deploy (alternative to CI)

```bash
# 1. Set env vars on Vercel project
# 2. Push to GitHub (or run locally):
vercel --prod
```

---

## Security

- **Transport:** HSTS `max-age=63072000; includeSubDomains; preload` (set in both `vercel.json` and `next.config.ts`)
- **CSP:** strict allow-list — `self` + Google Tag Manager / Analytics / Fonts / Maps + Vercel Speed Insights; `frame-ancestors 'none'`, `object-src 'none'`, `upgrade-insecure-requests` (`next.config.ts:5-31`)
- **Headers:** `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-site`
- **Permissions-Policy:** camera / microphone / payment / USB / clipboard-read disabled; geolocation and clipboard-write restricted to `self`
- **Auth:** bcrypt password hashing, JWT (jose) sessions, OTP-gated registration and password reset
- **Authorization:** role-based middleware (`src/middleware.ts`) plus per-route checks in API handlers
- **Audit:** every admin write goes through `ActivityLog` with a rollback payload
- **Disclosures:** see [`SECURITY.md`](./SECURITY.md)

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Run tests locally: `npm run test:run` and `npx playwright test`
4. Commit your changes
5. Open a PR — a Neon preview branch will be created automatically
6. On approval and merge to `main`, GitHub Actions deploys to Vercel production

---

## License

Private repository. All rights reserved.

---

**Ride safe. Ride together.**
*Tales on 2 Wheels — Brotherhood on two wheels since 2024*
