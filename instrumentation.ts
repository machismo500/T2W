// Next.js 15 instrumentation hook. Runs once per process/runtime on cold
// start; we use it to lazily import the runtime-appropriate Sentry config.
// Without this hook the server/edge configs would not be picked up under
// the new App Router model.

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Forwards server-side request errors to Sentry. App Router calls this for
// every uncaught error in a server component, route handler, or middleware.
export { captureRequestError as onRequestError } from "@sentry/nextjs";
