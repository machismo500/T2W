# T2W Usability Test Plan

A short, runnable script for evaluating Tales on 2 Wheels with real users.
Designed for the team to execute manually — no special tooling required.

## When to run it

- Once before every major UI change merges to `main`.
- Quarterly with 3–5 fresh participants (mix of: new prospect, T2W rider,
  core member).
- Ad-hoc whenever a feature ships and feels "different on the device than
  on the laptop."

## Roles needed

- **Facilitator** — guides the session, doesn't help solve tasks.
- **Note-taker** — records every hesitation, confusion, and recovery.
- **Participant** — uses the site on their own device, sharing screen.

## Setup before each session

1. Create a clean test account for the participant *(or use a real account
   the participant already owns)*.
2. Make sure at least one ride is in `upcoming` status with open
   registration.
3. Make sure at least one ride is in `completed` status with a recorded
   track (for post-ride view tasks).
4. Open Chrome DevTools → Performance Insights tab on the facilitator's
   end-mirror screen to catch slow renders.
5. Have the participant share screen + microphone.

## The session — 30-45 minutes

### 0. Warm-up (3 min)

> "I'm going to ask you to do a few things on this motorcycle club website.
> There are no wrong answers — if anything feels confusing, just say so
> out loud. You're not being tested, the website is."

Ask the participant:
- What kind of rider are you?
- Have you used a ride-organising site before? Which?

### 1. Anonymous discovery (5 min)

Open `https://taleson2wheels.com` in an **incognito window** (no login).

- **Task 1a.** "Find the next upcoming ride."
- **Task 1b.** "How would you join the group?"
- **Task 1c.** "Find one piece of evidence that this club is real / active
  / safe to ride with."

**Watch for:**
- Do they scroll past the hero or read it?
- Do they understand what "T2W Tales" means?
- Do they find the "How to Join" section, or scroll past?
- Do they trust the social proof? (member count, completed rides)

### 2. Registration flow (5 min)

- **Task 2.** "Create an account. Use any details you like."

**Watch for:**
- How many required fields before they hesitate?
- Do they understand the motorcycle picker?
- Do they get the "you'll be approved" wait time?
- Did anything time out, error, or look broken?

### 3. Browse + register for a ride (5 min)

After they're logged in:
- **Task 3a.** "Find a ride that excites you."
- **Task 3b.** "Sign up for it."
- **Task 3c.** "Confirm that you're signed up."

**Watch for:**
- Are the ride cards readable on mobile?
- Do they understand the fee?
- Do they get confused by "Pending approval" vs "Confirmed"?
- Do they look for, but fail to find, a calendar export?

### 4. Live tracking — pretend the ride is in progress (5 min)

Use the dev `?force-live=1` flag (or a staged live session) on the test
ride.

- **Task 4a.** "Imagine you're at the meeting point — find the live map."
- **Task 4b.** "Find the lead rider on the map."
- **Task 4c.** "Pretend your phone has no internet. What does the app do?"
  (Use Chrome DevTools → Network → Offline.)
- **Task 4d.** "Come back online — does anything happen?"

**Watch for:**
- The "Join Ride" CTA is clear, but is "Start tracking" obvious?
- When offline, do they notice the orange "GPS still recording" banner?
- After reconnect, do they see the "Synced N pings" pill?
- Does the map auto-pan to the rider's position?

### 5. Post-ride view (8 min)

Open a completed ride.

- **Task 5a.** "How long was this ride, and how fast did the lead rider
  go on average?"
- **Task 5b.** "Where did the ride start and end?"
- **Task 5c.** "Was there an elevation change?"
- **Task 5d.** "Watch the ride replay from start to finish — what does the
  fastest stretch look like?"
- **Task 5e (admin/superadmin only).** "Fix the recorded track — the GPS
  was patchy. Use the smooth-and-fill tool."
- **Task 5f (admin/superadmin only).** "The distance is wrong. Override
  it to 845 km."

**Watch for:**
- Do they find the stats card without prompting?
- Do they understand the track-style toggle (Source / Speed / Quality)?
- Does the elevation profile feel useful?
- Do they pick the scrubber up immediately?
- Do they preview before committing the smooth?

### 6. Wrap-up (5 min)

Ask:
- What did you find frustrating?
- Was there anything you expected that wasn't there?
- Would you use this with your own riding group? Why / why not?
- If you could change one thing, what would it be?

## What to grade each session on

For each task, rate 1–5 by **task success** *(did they complete it
unaided?)*, and 1–5 by **task ease** *(was it smooth?)*. Add raw
quotations — verbatim is gold.

| Task | Success (1–5) | Ease (1–5) | Notes / quote |
|------|--------------|-----------|---------------|
| 1a   | …            | …         | …             |
| 1b   | …            | …         | …             |
| …    | …            | …         | …             |

## What to do after each session

1. Within 24 hours, write a one-page summary: top 3 wins, top 3 frictions,
   verbatim quotes.
2. File one GitHub issue per friction point, tagged `usability`. Link the
   session note as evidence.
3. Compare against last session — patterns are more reliable than any
   single session.

## What this plan deliberately doesn't cover

- **Performance benchmarking** — use Lighthouse CI in the future.
- **Accessibility audit** — use `axe-core` browser extension or
  `@axe-core/playwright` for that, run separately.
- **Cross-device test matrix** — covered in a separate device QA pass.

## Suggested cadence

| Frequency | Activity                                             |
|-----------|------------------------------------------------------|
| Per PR    | Author runs through the checklist on their own device |
| Per sprint| One session with a real member (recorded if possible) |
| Quarterly | 3–5 sessions across roles + a written readout         |
| Per ride  | Ride lead writes one paragraph on app friction noticed during the ride |
