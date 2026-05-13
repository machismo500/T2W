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
| `GET /api/v1/notifications` | Top 50 notifications (per-user + global). |

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
