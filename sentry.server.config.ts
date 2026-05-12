// Sentry server-side init — Node runtime (API routes + server components).
// Loaded by `instrumentation.ts` register() in the Node runtime.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    sendDefaultPii: false,
    beforeSend(event) {
      // Same scrub as client: never ship cookies / auth headers, even from
      // server-side request frames.
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
