import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// Build a strict Content-Security-Policy that allows exactly the third-party
// origins this app uses (Google Analytics, Google Fonts) and nothing else.
const CSP = [
  "default-src 'self'",
  // Next.js requires 'unsafe-inline' for its inline runtime scripts.
  // JSON-LD <script> blocks also need it. We scope to known origins.
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com https://maps.googleapis.com",
  // Google Fonts CSS + Next.js style injection
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com",
  // Google Fonts woff2 files
  "font-src 'self' https://fonts.gstatic.com",
  // Images: self, data URIs (base64 avatars), blob (canvas), any HTTPS CDN
  "img-src 'self' data: blob: https:",
  // Fetch / XHR: self + GA telemetry + Google Maps API + Vercel Speed Insights + Sentry ingest
  "connect-src 'self' https://www.google-analytics.com https://analytics.google.com https://www.googletagmanager.com https://maps.googleapis.com https://maps.gstatic.com https://vitals.vercel-insights.com https://*.ingest.sentry.io https://*.sentry.io",
  // Service workers (offline support + Background Sync)
  "worker-src 'self'",
  // No plugins (Flash, Silverlight, etc.)
  "object-src 'none'",
  // No iframes from external origins
  "frame-src 'none'",
  "frame-ancestors 'none'",
  // Restrict <base> tag to prevent base-URI hijacking
  "base-uri 'self'",
  // Forms may only submit to same origin
  "form-action 'self'",
  // Upgrade any remaining http:// sub-resources
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // /home → / on any host (fixes taleson2wheels.com/home 404 too)
      {
        source: "/home",
        destination: "/",
        permanent: true,
      },
      // Redirect all bangaloremotorcycleclub.com traffic → taleson2wheels.com
      {
        source: "/:path*",
        has: [{ type: "host", value: "bangaloremotorcycleclub.com" }],
        destination: "https://www.taleson2wheels.com/:path*",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.bangaloremotorcycleclub.com" }],
        destination: "https://www.taleson2wheels.com/:path*",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // ── Transport & protocol ─────────────────────────────────────────
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // ── Content / MIME ───────────────────────────────────────────────
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          // ── Clickjacking (redundant with CSP frame-ancestors but belt+suspenders) ─
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          // ── Referrer ─────────────────────────────────────────────────────
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          // ── Cross-Origin policies ─────────────────────────────────────────
          {
            // Prevent other sites from embedding this site in a popup/tab
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            // Prevent other origins from reading this site's resources
            key: "Cross-Origin-Resource-Policy",
            value: "same-site",
          },
          // ── Feature / Permissions policy ─────────────────────────────────
          {
            // Disable browser features the app doesn't use
            key: "Permissions-Policy",
            value: [
              "camera=()",
              "microphone=()",
              "payment=()",
              "usb=()",
              "geolocation=(self)",
              "clipboard-read=()",
              "clipboard-write=(self)",
            ].join(", "),
          },
          // ── Content Security Policy ───────────────────────────────────────
          {
            key: "Content-Security-Policy",
            value: CSP,
          },
          // NOTE: X-XSS-Protection intentionally omitted — it is deprecated
          // and causes issues in modern Chromium-based browsers.
        ],
      },
    ];
  },
};

// Sentry build-time wrap. Without a DSN this is essentially a no-op: the
// wrapper still injects its instrumentation client, but no events ever
// transmit because sentry.{client,server,edge}.config.ts short-circuits on
// missing DSN. Source-map upload + release tagging happens only when
// SENTRY_ORG / SENTRY_PROJECT / SENTRY_AUTH_TOKEN are present.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Silence the build-step source-map upload when running locally without
  // credentials.
  silent: !process.env.CI,
  // Strip source-map upload references from the public bundle (so the
  // SourceMappingURL hint doesn't leak our internal build path).
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  // Don't fail the build if Sentry's CLI step errors — instrumentation
  // still works without source maps.
  disableLogger: true,
});
