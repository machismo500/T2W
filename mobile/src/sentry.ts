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

export const captureException = Sentry.captureException;
