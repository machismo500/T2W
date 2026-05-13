import { NextRequest, NextResponse } from "next/server";
import { checkRate, checkRateSync } from "@/lib/rate-limit";

// ---------------------------------------------------------------------------
// Known malicious / scanner user-agents
// ---------------------------------------------------------------------------
const BAD_UA = /sqlmap|nikto|nmap|masscan|zgrab|dirbuster|gobuster|nuclei|hydra|medusa|metasploit|wfuzz|openvas|acunetix|nessus|burpsuite|whatweb|w3af|appscan|webinspect|havij|pangolin/i;

// ---------------------------------------------------------------------------
// Attack signatures — checked against decoded query string
// ---------------------------------------------------------------------------
const ATTACK_PATTERNS: RegExp[] = [
  // SQL injection
  /(\b(select|union\s+select|insert\s+into|update\s+\w+\s+set|delete\s+from|drop\s+(table|database)|create\s+table|alter\s+table|exec\s*\(|execute\s*\(|xp_cmdshell)\b)/i,
  /('|\%27)\s*(or|and)\s+('|\%27|1|true|false)/i,
  /\b(or|and)\b\s+\d+\s*[=<>!]+\s*\d+/i,               // boolean injection: OR 1=1, AND 2>1
  /(--|#)\s*$/,                                          // SQL comment terminator
  /\bwaitfor\s+delay\b|\bsleep\s*\(/i,                   // blind SQL time-based
  // XSS
  /<\s*script[\s>\/]/i,
  /javascript\s*:/i,
  /vbscript\s*:/i,
  /on(load|error|click|mouseover|keyup|focus|blur|input|submit|change|drag|drop)\s*=/i,
  /\beval\s*\(/i,
  /expression\s*\(/i,                                    // CSS expression()
  // Path / directory traversal
  /\.\.[\/\\]/,
  /%2e%2e[%2f%5c]/i,
  /%252e%252e/i,                                         // double-encoded
  // Command injection
  /[;&|`]\s*(ls|cat|id|whoami|uname|passwd|shadow|wget|curl|bash|sh|cmd|powershell|nc\s)/i,
  // SSRF
  /(localhost|127\.0\.0\.1|0\.0\.0\.0|169\.254\.|::1|@localhost)/i,
  // XXE / entity injection
  /<!entity\b/i,
  /<!doctype[^>]+system\b/i,
];

function isAttack(url: URL): boolean {
  try {
    // Replace + with space first (form-encoding), then decode %xx sequences
    const qs = decodeURIComponent(url.search.replace(/\+/g, " "));
    return ATTACK_PATTERNS.some((p) => p.test(qs));
  } catch {
    return false; // malformed URI — let CSP/other layers handle it
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getClientIP(req: NextRequest): string {
  return (
    req.headers.get("cf-connecting-ip") ??              // Cloudflare
    req.headers.get("x-real-ip") ??                     // Vercel-injected (not client-controllable)
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown"
  );
}

function block(reason: string, status: number): NextResponse {
  return new NextResponse(
    JSON.stringify({ error: reason }),
    { status, headers: { "Content-Type": "application/json" } }
  );
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { nextUrl, headers } = request;
  const host = headers.get("host") ?? nextUrl.hostname;
  const isLocalhost = host.includes("localhost") || host.includes("127.0.0.1");
  const ip = getClientIP(request);
  const ua = headers.get("user-agent") ?? "";
  const pathname = nextUrl.pathname;

  // ── 1. HTTPS redirect (production only) ───────────────────────────────────
  if (process.env.NODE_ENV === "production" && !isLocalhost) {
    const proto = headers.get("x-forwarded-proto");
    const sslOff = headers.get("x-forwarded-ssl") === "off";
    if (proto === "http" || sslOff || nextUrl.protocol === "http:") {
      const httpsUrl = nextUrl.clone();
      httpsUrl.protocol = "https:";
      httpsUrl.port = "";
      return NextResponse.redirect(httpsUrl, 301);
    }
  }

  // ── 2. Block malicious scanners / automated attack tools ─────────────────
  if (BAD_UA.test(ua)) {
    return block("Forbidden", 403);
  }

  // ── 3. Attack pattern detection in query string ───────────────────────────
  if (isAttack(nextUrl)) {
    return block("Bad request", 400);
  }

  // ── 4. Rate limiting ──────────────────────────────────────────────────────
  // Auth routes get the KV-backed limiter (persistent across cold starts and
  // Lambda instances). General + api routes stay on the per-instance
  // in-memory check — they're best-effort abuse protection, not security-
  // critical, and we don't want the extra ~30 ms KV round-trip on every page.
  const isAuthRoute = /^\/api\/(?:v1\/)?auth\/(login|register|send-otp|verify-otp|send-reset-otp|verify-reset-otp|reset-password|refresh)/.test(pathname);
  const isApiRoute  = pathname.startsWith("/api/");

  if (isAuthRoute) {
    if (await checkRate(ip, "auth")) {
      return block("Too many requests — please slow down", 429);
    }
  } else {
    const limitType = isApiRoute ? "api" : "general";
    if (checkRateSync(ip, limitType)) {
      return block("Too many requests — please slow down", 429);
    }
  }

  // ── 5. CORS for mobile clients (/api/v1/* only) ──────────────────────────
  // Native iOS/Android apps don't enforce CORS, but Expo Go and web previews
  // do. We allow any origin for /api/v1 — the bearer-token requirement is
  // what protects access; the cookie-based /api/* tree stays cookie-locked.
  if (pathname.startsWith("/api/v1/")) {
    const origin = headers.get("origin") ?? "*";
    if (request.method === "OPTIONS") {
      return new NextResponse(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
          "Access-Control-Allow-Headers": "authorization,content-type,x-device-id,x-app-build",
          "Access-Control-Max-Age": "86400",
          "Vary": "Origin",
        },
      });
    }
    const res = NextResponse.next();
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Vary", "Origin");
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Skip Next.js internals and static assets
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
