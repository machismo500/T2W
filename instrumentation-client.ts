// Client-side instrumentation hook. Next.js 15 picks this up automatically
// and runs the body on first client render — equivalent to dynamic-import
// of sentry.client.config but with a lifecycle that fires reliably under
// App Router.

import "./sentry.client.config";
