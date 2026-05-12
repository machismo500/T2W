# T2W Improvement Recommendations

A grounded look at the codebase as it stands today, with prioritised
suggestions for what to ship next. Conclusions are based on a survey of:

- 17 page routes
- 77 API routes
- ~800 unit tests across 80 files
- 16 Playwright E2E specs (252 tests)
- Prisma schema, observability stack, and shared components

Recommendations are sorted by **impact ÷ effort**, not difficulty.

---

## Tier 0 — bugs and risks already visible

Things that aren't features but should be fixed before adding more.

### 0.1 No production error tracking

`grep -r "Sentry|datadog|posthog"` returns nothing. There are **79 files
with `console.error`** but those go nowhere in production. The very issues
the user found by manually clicking around (CTA login state, ride
statistics not refreshing) would have been silent crashes elsewhere.

> **Action.** Add Sentry (or any equivalent). Free tier is enough for a
> club-scale app. Set up a Slack channel for new errors. Estimated time:
> half a day.

### 0.2 No rate limiting on public endpoints

`/api/auth/login`, `/api/contact`, and most ride read endpoints are
unauthenticated and uncapped. A single bad actor (or a misbehaving cron
job) can hammer the DB. Neon has a per-second query budget; a 50 req/s
flood will tip the free tier into throttling.

> **Action.** Add `@upstash/ratelimit` (or middleware-level token bucket)
> on `/api/auth/*`, `/api/contact`, `/api/site-settings` writes. ~1 day.

### 0.3 Email job durability

The ride-create flow uses Next 15's `after()` to dispatch announcement
emails. `after()` is best-effort — if the lambda crashes mid-send,
emails are lost silently. There's no retry, no DLQ.

> **Action.** Move email send into the existing `ScheduledEmail` table
> with a cron that retries failures. Wire it the same way as
> `scheduled-emails`. ~1–2 days.

### 0.4 Service worker offline GPS — already shipped, but no real-device test

The flush-bug fix has unit tests, but no real-device verification under
genuine signal loss. The pre-existing 2 e2e Playwright failures (CSP /
eval()) only got fixed when an env var was set; means we shipped 252-pass
suite ignoring "known broken" tests for a long time.

> **Action.** During the next ride, ask one rider to deliberately put
> their phone in airplane mode for 10 minutes. Verify recordedAt
> chronology in the DB after. ~1 hour.

---

## Tier 1 — biggest UX wins

### 1.1 Loading states everywhere

We have a `<Skeleton>` component and the `RidesPage` uses it. **Only 20 of
~60 list-fetching components** show any loading state — most render
`null` or an empty card until the data arrives. On a slow phone the page
appears broken for ~2 s.

> **Action.** Audit every page that calls `fetch` on mount. Each should
> render either a skeleton, a count placeholder, or "Loading…". ~3 days.

### 1.2 Empty states

No rides yet on `/rides`? Currently shows an empty grid with no
explanation. Same on `/blogs`, `/riders` directory. Empty states should
explain what the user is seeing and what comes next.

> **Action.** One reusable `<EmptyState>` with icon, headline, body, CTA.
> ~1 day to component + half-day to retrofit. Cheap and impactful.

### 1.3 Mobile experience pass

Most members open the site on phones. Audit each page on a 360×740
viewport:
- Long ride titles overflow `RideCard`.
- The map editor modal scrolls awkwardly on iOS Safari (sticky header
  detaches).
- The Stats override inputs are too narrow to tap reliably (`w-32`).

> **Action.** Set up a Playwright project with a mobile-Chrome emulation
> profile and add 10–20 smoke tests. ~2 days. Then walk each page on a
> real phone. ~1 day.

### 1.4 Accessibility (a11y) — currently very thin

`grep aria-` returns only 20 occurrences across the codebase. Nothing on
`@axe-core` audits. The map editor uses non-semantic `<div>` buttons in
places. Color-only state indicators (the new "Registered" pill works for
sighted users only).

> **Action.** Install `@axe-core/playwright`, add 3 spec lines per page to
> flag violations. Aim to clear `level: serious` violations before adding
> more features. ~2 days.

### 1.5 Calendar export ("Add to Calendar" on ride card)

Most riders use Google Calendar / Apple Calendar to plan their weekends.
The site has no `.ics` export, no Google Calendar deep link. Forces them
to manually add the meetup time. This is a high-trust convenience win.

> **Action.** Add a `GET /api/rides/[id]/ics` route returning a VCALENDAR
> blob; surface it as a small `+ Add to calendar` link on the ride card
> and detail page. ~half a day.

### 1.6 Notifications are email-only

`/api/notifications` exists but only delivers via SMTP. No push, no
in-app, no SMS for ride-day comms. On the day of a ride, an SMS to all
confirmed riders ("ride starts in 1h, weather changed") would replace
the current WhatsApp group thread.

> **Action.** Add a Twilio integration toggleable per-ride. Behind a
> super-admin "Notify all confirmed riders" button on the ride admin
> page. ~3 days.

---

## Tier 2 — engagement features

### 2.1 Ride photos as a first-class object

Today, post-ride photos live in ride-tales (which is a blog post).
Photos should be uploadable directly from the live-tracking page
mid-ride, geotagged to the user's current GPS position, and surfaced
on the post-ride map as pin clusters. The most-shared content on
biker communities is photos of bikes at scenic stops.

> **Action.**
> - New `RidePhoto` model: `{rideId, userId, lat, lng, recordedAt, blobUrl,
>   caption}`.
> - "📷 Add photo" button on live page when tracking is on.
> - Cluster markers on the post-ride map, click to open photo.
> - ~5 days.

### 2.2 Comments / reactions on ride tales + photos

Ride tales currently have no reply / reaction surface. Discussion drifts
to WhatsApp. The web should be the single source of truth.

> **Action.** Lightweight `Comment` model with userId/parentId for
> threaded replies, plus emoji-reactions (👍❤️🔥). ~4 days.

### 2.3 Strava / Komoot import

Many riders track on Strava already. Letting them import a Strava
activity into a T2W ride's "recorded track" would mean the rider gets
their stats in one place and the club gets richer multi-source maps for
the same ride.

> **Action.** OAuth-with-Strava on the user profile page, ingest an
> activity, normalize into `LiveRideLocation` rows. Big payoff for low
> ongoing maintenance. ~5–7 days.

### 2.4 Badges that update on a real schedule

`Badge` rows exist but the awarding logic appears to be cron-driven and
opaque. Riders rarely see when they cross a threshold. A "you earned the
1000 km badge!" toast on the next login is sticky.

> **Action.** Move badge evaluation into the post-ride `end` action — run
> badge check at ride-end for each participant, emit a notification on
> award. ~2 days.

### 2.5 Profile gamification

A `/profile` page that shows distance-this-year, # rides, badges earned,
trail of completed rides on a single map. This is the single page riders
will screenshot and post.

> **Action.** Compose the existing `/api/stats?userId=X` + ride history
> into a one-page "ride card" similar to Strava's year-in-review.
> ~3 days.

---

## Tier 3 — operational maturity

### 3.1 Test coverage holes — admin surface

The admin page is the largest single file in the repo and the test surface
is thin compared to the rides flow. With core_member now empowered to
edit ride map/stats (via the new permission), the blast radius of an
admin-page regression is wider than before.

> **Action.** Spec out 20–30 e2e tests over the admin tabs (Users,
> Permissions, Ride Roster, Settings). ~3 days. Roll them into a slow CI
> stage that gates `main`.

### 3.2 No CI gate

`vitest` and `playwright` run on demand. No GitHub Actions / Vercel
preview check enforces them. The fix-CTA bug shipped in part because no
e2e test covered the home page CTAs — and even if one had, nothing would
have blocked the merge.

> **Action.** GitHub Actions workflow: on PR open, run lint + vitest +
> minimal e2e (~30s). Slow e2e in nightly. Block merge on failure.
> ~1 day. Compound payoff every PR forever.

### 3.3 Observability beyond errors

After adding Sentry, add at least basic web-vitals capture and a
dashboard showing:
- 95th-percentile page-load on mobile
- /api/rides p95 latency
- # ride registrations per day
- # offline-queue flushes per day

Without these numbers, every "the app feels slow" complaint goes
unfalsified.

> **Action.** Vercel Analytics + Speed Insights is one button click on
> Vercel and free at this traffic level. ~1 hour.

### 3.4 Data backup drill

Neon has built-in backups, but there's no documented restore procedure.
"Can we restore last Tuesday's DB?" should be answerable in 10 minutes.

> **Action.** Document the restore steps in `docs/runbooks/restore.md`.
> Do an actual restore against a staging Neon branch once a quarter.
> ~half a day per drill.

### 3.5 Feature flags

Risky features (the new Smooth & fill that calls paid Google APIs, the
elevation profile, the replay scrubber) currently ship to 100% of users
on merge. A flag-gated rollout would let us turn off a misbehaving
feature without a redeploy.

> **Action.** GrowthBook or LaunchDarkly, or roll our own via the
> existing `SiteSettings.role_permissions` pattern. ~2 days for a
> minimal in-house version.

---

## Tier 4 — strategic / "if we wanted to grow"

### 4.1 Multi-club instance

If a Hyderabad biker group asks to use T2W's site for their own rides,
the current schema can't isolate them (no `clubId` foreign key on rides /
users). Worth thinking about now, before the data model grows further.

### 4.2 Public ride embed widget

A single-file `<script src=".../t2w-embed.js" data-club="t2w">` that
renders "Next upcoming ride" on any external blog. Free distribution.

### 4.3 Ride-leader copilot

A short pre-ride checklist (helmet check, fuel, tire pressure, rain gear)
that the lead rider ticks off and the ride participants see. Tiny
feature, big trust signal.

### 4.4 Sponsored-content slots

If T2W gets revenue from a gear sponsor, a config-driven "Recommended by
T2W" card on the ride detail page. Avoid retrofitting later.

---

## What I'd ship in the next 2 weeks

Given roughly one developer-week of capacity, in priority order:

1. **Sentry + Vercel Speed Insights** (1 day, Tier 0.1 / 3.3)
2. **Rate limiting** on auth + contact (1 day, Tier 0.2)
3. **CI gate on PRs** with lint + vitest + smoke e2e (1 day, Tier 3.2)
4. **Loading + empty states pass** across the 5 most-trafficked pages
   (2 days, Tier 1.1 / 1.2)
5. **Calendar (.ics) export** on ride cards (½ day, Tier 1.5)
6. **Real-device offline GPS test** during the next ride (½ day, Tier 0.4)

Everything else can wait or be slotted in as features evolve.

---

## What I would NOT do right now

- **Native mobile app.** PWA + push notifications gets you 90% of the
  perceived-mobile-app benefit at 5% of the cost.
- **Generic chat / messaging.** Better discussion lives on existing
  WhatsApp groups for now; replicating that surface is high cost,
  marginal value.
- **AI-generated ride tales / summaries.** Real members posting their
  own stories is the moat. Don't dilute.

---

## Open questions for the team

1. What's the rough share of mobile-vs-desktop traffic today? (Vercel
   Analytics would answer.)
2. Of users who register, what fraction completes their first ride? The
   funnel after register-for-ride is currently unmeasured.
3. Is there appetite to add Strava OAuth? It opens a meaningful import
   surface but also a privacy obligation.
4. Who owns ongoing photo storage costs as ride photos scale? (Vercel
   Blob is cheap, but not zero.)
