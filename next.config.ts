import type { NextConfig } from "next";

// Build a strict Content-Security-Policy that allows exactly the third-party
// origins this app uses (Google Analytics, Google Fonts) and nothing else.
const CSP = [
  "default-src 'self'",
  // Next.js requires 'unsafe-inline' for its inline runtime scripts.
  // JSON-LD <script> blocks also need it. We scope to known origins.
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com",
  // Google Fonts CSS + Next.js style injection
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  // Google Fonts woff2 files
  "font-src 'self' https://fonts.gstatic.com",
  // Images: self, data URIs (base64 avatars), blob (canvas), any HTTPS CDN
  "img-src 'self' data: blob: https:",
  // Fetch / XHR: self + GA telemetry + Vercel Speed Insights
  "connect-src 'self' https://www.google-analytics.com https://analytics.google.com https://www.googletagmanager.com https://vitals.vercel-insights.com",
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

export default nextConfig;
