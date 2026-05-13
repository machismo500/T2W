import * as Sentry from "@sentry/react-native";
import Constants from "expo-constants";

let initialized = false;

/**
 * Initialise Sentry exactly once at app start. Safe to call even if no DSN
 * is configured — we no-op silently and the rest of the app behaves the
 * same. Same Sentry org as the web app.
 */
export function initSentry() {
  if (initialized) return;
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    return;
  }
  Sentry.init({
    dsn,
    enableAutoSessionTracking: true,
    enableNative: true,
    environment: __DEV__ ? "development" : "production",
    release: Constants.expoConfig?.version ?? undefined,
    // Capture 10% of transactions in production; everything in dev so we
    // can sanity-check perf instrumentation while building.
    tracesSampleRate: __DEV__ ? 1.0 : 0.1,
    // Avoid spamming Sentry for routine cancels / aborts.
    ignoreErrors: ["AbortError", "Network request failed"],
  });
  initialized = true;
}

export function setSentryUser(user: { id: string; email: string } | null) {
  if (!initialized) return;
  if (user) {
    Sentry.setUser({ id: user.id, email: user.email });
  } else {
    Sentry.setUser(null);
  }
}

type CaptureExtras = { extra?: Record<string, unknown>; tags?: Record<string, string> };

export function captureException(err: unknown, opts: CaptureExtras = {}) {
  if (!initialized) {
    // Surface to console so dev still sees the error even without Sentry.
    console.error("[T2W]", err, opts);
    return;
  }
  Sentry.withScope((scope) => {
    if (opts.extra) {
      for (const [k, v] of Object.entries(opts.extra)) {
        scope.setExtra(k, v as unknown);
      }
    }
    if (opts.tags) {
      for (const [k, v] of Object.entries(opts.tags)) {
        scope.setTag(k, v);
      }
    }
    Sentry.captureException(err);
  });
}
