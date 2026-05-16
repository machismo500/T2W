# T2W API v1 — overview for client implementers

**Status:** Foundation shipped. Not all endpoints migrated yet. See "Coverage" below.

This document is the entry point for anyone consuming the T2W API from the
web app, an Android app, an iOS app, or any other client. The contract is
auto-generated and served — clients should NOT hand-code request shapes.

---

## 1. Where the contract lives

- **OpenAPI 3.1 spec (source of truth):** `openapi/openapi.json`, committed.
  Generated from zod schemas in `src/lib/api/schemas/*.ts` via
  `npm run openapi:generate`.
- **Served at runtime:** `GET /api/v1/openapi.json`.
- **CI gate:** `.github/workflows/api-spec.yml` runs `npm run openapi:check`
  on every PR that touches the API layer; the build fails if the committed
  spec is out of date.

Clients in separate repos should run an OpenAPI codegen step
(`openapi-typescript`, `openapi-generator-cli`, etc.) against either the
committed `openapi/openapi.json` file or the live `/api/v1/openapi.json`
endpoint.

## 2. Auth model — dual mode

Every protected `/api/v1/*` route accepts **either**:

1. **`Authorization: Bearer <jwt>`** — short-lived (15 min) access token
   from `POST /api/v1/auth/login`. Rotate via `POST /api/v1/auth/refresh`.
   Used by mobile clients.
2. **`Cookie: t2w-token=<jwt>`** — the existing HttpOnly cookie set by the
   web app. Used by the web client. No change to web auth flow.

The route handler doesn't care which one is presented. See
`src/lib/api/auth/context.ts` for the entry-point logic.

## 3. Token lifecycle

| Token | TTL | Storage on client | How to refresh |
|---|---|---|---|
| Access | 15 min | In-memory only | Exchange refresh at `/auth/refresh` |
| Refresh | 60 days | OS keychain / secure store on mobile; cookie on web | Rotated on every use; reuse detection revokes the whole token family |

Reuse detection: if the same refresh token is presented twice, every
refresh token sharing its `familyId` is revoked immediately. The client
must re-login.

## 4. Error envelope

All `/api/v1/*` responses use a stable error shape:

```json
{
  "error": {
    "code": "VALIDATION",
    "message": "Request validation failed",
    "details": [
      { "path": "email", "message": "Invalid email" }
    ]
  },
  "requestId": "01J..."
}
```

`code` values (stable, machine-readable): `UNAUTHORIZED`, `FORBIDDEN`,
`NOT_FOUND`, `VALIDATION`, `CONFLICT`, `RATE_LIMITED`, `RIDE_FULL`,
`RIDE_NOT_OPEN`, `REFRESH_REUSE`, `REFRESH_INVALID`,
`UNSUPPORTED_MEDIA_TYPE`, `BAD_REQUEST`, `INTERNAL`.

Every response carries an `x-request-id` header. Quote this when filing
support tickets — it's logged on the server alongside the handler name
and duration.

## 5. Pagination

Cursor-paginated list endpoints follow:

```
GET /api/v1/<resource>?cursor=<opaque>&limit=20

200 OK
{ "data": [...], "pageInfo": { "nextCursor": "..." | null } }
```

When `nextCursor` is `null`, you've reached the end.

## 6. Coverage (Phase 1)

Currently in `/api/v1`:

- **Auth:** `login`, `refresh`, `logout`, `me`, `register`, `send-otp`,
  `verify-otp`, `send-reset-otp`, `verify-reset-otp`, `reset-password`
- **Devices:** `POST /api/v1/devices`, `DELETE /api/v1/devices/{id}`
- **Rides:** `GET /api/v1/rides` (cursor-paginated), `GET /api/v1/rides/{id}`
- **Meta:** `GET /api/v1/openapi.json`

Everything else still lives under `/api/*` with cookie auth. Subsequent
phases will migrate read-mostly endpoints (riders, leaderboard, badges,
blogs, guidelines), then the live-ride endpoints, then write + admin.
See `/root/.claude/plans/` for the full rollout plan (internal).

## 7. Adding a new endpoint

1. Define input/output zod schemas in `src/lib/api/schemas/<resource>.ts`.
2. Write a pure handler in
   `src/lib/api/handlers/<resource>/<action>.ts` exporting
   `(input, ctx) => Promise<Result>`. Throw `ApiError` for non-2xx cases.
3. Call `registerRoute(...)` at the top of the handler module so the spec
   picks it up.
4. Add the handler import to `src/lib/api/openapi/handlers.ts`.
5. Create `src/app/api/v1/<resource>/<action>/route.ts` as a 10-line
   wrapper using `withApi(...)` (or `runApi(...)` for path-param routes).
6. Run `npm run openapi:generate` and commit the regenerated spec.
7. Add a handler unit test and a route integration test under
   `src/__tests__/api/v1/`.
