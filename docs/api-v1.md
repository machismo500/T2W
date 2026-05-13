# `/api/v1` — mobile API surface

The bearer-token API used by the iOS and (future) Android apps. Lives
alongside the existing cookie-based `/api/*` web API; that one is
**not** deprecated.

## Authentication

| Step | Endpoint | Auth |
|---|---|---|
| Sign in | `POST /api/v1/auth/login` | none |
| Sign up | `POST /api/v1/auth/register` | none |
| Rotate tokens | `POST /api/v1/auth/refresh` | none (refresh token in body) |
| Sign out | `POST /api/v1/auth/logout` | bearer |
| Current user | `GET /api/v1/auth/me` | bearer |
| Email OTP | `POST /api/v1/auth/send-otp`, `POST /api/v1/auth/verify-otp` | none |
| Password reset | `POST /api/v1/auth/send-reset-otp`, `…/verify-reset-otp`, `…/reset-password` | none |

### Token model

- **Access token** — JWT, 15 minute TTL, audience `t2w-mobile`. Sent as
  `Authorization: Bearer <token>`. Never persisted on the device.
- **Refresh token** — opaque random 48 bytes (base64url), 60 day rolling
  TTL. Stored on device in iOS Keychain / Android Keystore via
  `expo-secure-store`. Server stores **SHA-256** of the token, not the
  token itself.

Refresh rotates: each `/auth/refresh` issues a new refresh token and
revokes the previous one. If a revoked token is presented again, **all**
refresh tokens for that user are revoked (reuse detection).

Password reset also revokes all refresh tokens for the user.

### Login response

```json
{
  "accessToken": "<jwt>",
  "accessTokenExpiresIn": 900,
  "refreshToken": "<opaque>",
  "refreshTokenExpiresAt": "2026-07-12T10:42:00.000Z",
  "user": { /* full user with motorcycles + earnedBadges */ }
}
```

## Error envelope

All non-2xx responses use a stable shape:

```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password",
    "details": { /* optional */ }
  }
}
```

Codes (see `src/lib/api/v1/errors.ts`):

`BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`,
`UNPROCESSABLE`, `RATE_LIMITED`, `SERVER_ERROR`, `EMAIL_SERVICE_DOWN`,
`INVALID_CREDENTIALS`, `INVALID_TOKEN`, `TOKEN_REUSED`, `RIDE_FULL`,
`ALREADY_REGISTERED`.

## Rides

| Endpoint | Description |
|---|---|
| `GET /api/v1/rides?status=upcoming&cursor=…&limit=20` | Cursor-paginated list. `limit` capped at 50. |
| `GET /api/v1/rides/:id` | Full ride detail incl. confirmed riders, participations, your registration. |
| `POST /api/v1/rides/:id/register` | Register the current user. Tier-gated, capacity-checked, transactional. |
| `GET /api/v1/rides/:id/live[?since=ISO]` | Live session state + latest position per rider + lead/own polyline. `since` for delta polling. |
| `POST /api/v1/rides/:id/live/join` | Join the live session. Returns `isLead` / `isSweep`. |
| `POST /api/v1/rides/:id/live/break` | `{ action: "start" \| "end", reason? }` — admin only. Exclusive break, pauses session. |
| `GET /api/v1/rides/:id/live/metrics` | Group + personal metrics (distance, moving time, speeds). |
| `POST /api/v1/rides/:id/live/location` | Batch breadcrumb upload (see below). |

### Batch live-location upload

The headline mobile feature. Body:

```json
{
  "points": [
    {
      "lat": 12.97,
      "lng": 77.59,
      "speed": 14.2,
      "heading": 92.0,
      "accuracy": 8.5,
      "recordedAt": "2026-05-13T10:42:00.000Z"
    }
  ]
}
```

- Max 200 points per call.
- `recordedAt` is optional; rejected if unparseable, in the future
  (>60 s skew), or older than 24 hours. Individual rejected points come
  back in `rejected[]` and accepted ones still get written.
- Server checks each point against the planned route and sets
  `isDeviated` if more than 200 m off.

Response:

```json
{ "accepted": 50, "rejected": [], "anyDeviation": false }
```

## Devices (push tokens)

| Endpoint | Description |
|---|---|
| `POST /api/v1/devices` | Upsert this device's FCM/APNs token. Body: `{ token, platform, deviceId, appBuild? }`. Keyed by `(userId, deviceId)`. |
| `DELETE /api/v1/devices?deviceId=…` | Remove this device's token (e.g. on sign-out). |

## Notifications

| Endpoint | Description |
|---|---|
| `GET /api/v1/notifications` | Top 50 notifications (per-user + global). Each row includes `isRead`. |
| `POST /api/v1/notifications/:id/read` | Mark a single notification as read. Owner-scoped. |
| `POST /api/v1/notifications/read-all` | Mark all of the current user's unread notifications as read. |

## Push dispatch (server side)

`src/lib/push/dispatch.ts` exports `notifyUser({ userId, title, message, type, data })` and `notifyMany(userIds, args)`. Both insert a Notification row **and** push to every registered `DeviceToken` via the Expo Push API (https://exp.host/--/api/v2/push/send). Tokens that come back as `DeviceNotRegistered` are pruned in the same call.

Push triggers wired so far:

- `PUT /api/users/:id/approve` and `POST /api/users/bulk-approve` — "You're in!"
- `PATCH /api/rides/:id/registrations/:regId` — registration confirmed / rejected / dropout
- `POST /api/rides/:id/notify-reminder` — fan-out to the same audience as the email reminder
- `PUT /api/blogs/:id` — author notified on approve / reject transitions
- `PUT /api/ride-posts/:id` — author notified on approve / reject transitions

Payloads carry a `data` field with a `kind` discriminator (`ride` | `blog` | `account_approved`) so the mobile tap handler can deep-link.

## Riders / Garage / Achievements / Guidelines / Blogs

| Endpoint | Description |
|---|---|
| `GET /api/v1/riders?period=6m\|1y\|all&search=name` | Leaderboard. PII included only for admins. |
| `GET /api/v1/motorcycles` | Current user's garage. |
| `POST /api/v1/motorcycles` | Add a motorcycle. |
| `PATCH /api/v1/motorcycles/:id` | Update. Scoped to owner. |
| `DELETE /api/v1/motorcycles/:id` | Remove. |
| `GET /api/v1/badges` | Badge catalogue. |
| `GET /api/v1/achievements` | Current user's earned badges. |
| `GET /api/v1/guidelines` | Riding guidelines (cacheable). |
| `GET /api/v1/blogs?cursor=…&limit=20` | Approved blog posts, cursor-paginated. |
| `GET /api/v1/blogs/:id` | Blog detail. |

## Site settings (UPI)

| Endpoint | Description |
|---|---|
| `GET /api/v1/site-settings/:key` | Public keys: `upi_config`, `reg_form_settings`, `arena_weights`, `achievement_settings`, `role_permissions`. Other keys require admin. |

## Upload

| Endpoint | Description |
|---|---|
| `POST /api/v1/upload` | Multipart image upload. Fields: `file` (or `dataUrl`), `type` (`avatar` \| `payment-proof` \| `ride-poster` \| `blog-cover` \| `ride-post` \| `motorcycle` \| `misc`), `targetId?`. Returns `{ url }`. |

## Health

`GET /api/v1/health` → `{ "status": "ok", "apiVersion": "v1" }`. No auth.

## CORS

All `/api/v1/*` routes echo the request origin and answer `OPTIONS`
preflights from middleware. The bearer-token requirement is the actual
access control — there are no cookies in this tree.

## Rate limiting

Auth routes (`/api/v1/auth/login|register|send-otp|verify-otp|send-reset-otp|verify-reset-otp|reset-password|refresh`) share the same KV-backed
limiter as the web auth routes. All other `/api/v1/*` routes go through
the per-instance API limiter.

## Roadmap (not yet implemented)

- `POST /api/v1/rides/:id/register` — mobile-shaped ride registration
- `POST /api/v1/rides/:id/live/join` and live session endpoints
- `GET /api/v1/riders` (leaderboard) and `GET /api/v1/riders/:id`
- `GET/POST /api/v1/motorcycles`
- `GET /api/v1/blogs`, `GET /api/v1/ride-posts`
- `GET/PATCH /api/v1/admin/*` (Phase 3)
- Server-side FCM/APNs push dispatch from notification creation paths

See `docs/mobile-apps-plan.md` §5 for the planned full surface.
