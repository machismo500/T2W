// Sentry client-side initialisation.
//
// Loaded by `instrumentation-client.ts` -> Sentry SDK auto-wires the global
// error / unhandledrejection / web-vitals capture in the browser.
//
// PII policy: we never want auth tokens / cookies leaving the browser. The
// `beforeSend` filter scrubs them before the event is uploaded.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    // Session replay is disabled until the team has reviewed privacy
    // implications. Keep at 0 — turn on per-error if needed later.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    sendDefaultPii: false,
    beforeSend(event) {
      // Strip cookies and auth headers — our t2w_auth_token JWT must never
      // be uploaded to a third-party.
      if (event.request) {
        delete event.request.cookies;
        if (event.request.headers) {
          for (const k of Object.keys(event.request.headers)) {
            if (/^(cookie|authorization)$/i.test(k)) {
              delete event.request.headers[k];
            }
          }
        }
      }
      if (event.user) {
        delete event.user.email;
        delete event.user.ip_address;
      }
      return event;
    },
  });
}
