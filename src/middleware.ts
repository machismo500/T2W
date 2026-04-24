import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Rate-limit config (per IP, per route class)
// ---------------------------------------------------------------------------
const RATE_LIMITS = {
  auth:    { window: 60_000, max: 10  }, // login / register / OTP
  api:     { window: 60_000, max: 60  }, // general API
  general: { window: 60_000, max: 300 }, // pages & static
};

// In-memory store (per edge-node instance; resets on cold start — fine for WAF)
const rateMap = new Map<string, { count: number; resetAt: number }>();

// Periodically prune expired entries to prevent unbounded growth
let lastPrune = Date.now();
function pruneRateMap() {
  const now = Date.now();
  if (now - lastPrune < 120_000) return;
  lastPrune = now;
  for (const [key, entry] of rateMap) {
    if (now > entry.resetAt) rateMap.delete(key);
  }
}

function isRateLimited(ip: string, type: keyof typeof RATE_LIMITS): boolean {
  pruneRateMap();
  const { window, max } = RATE_LIMITS[type];
  const now = Date.now();
  const key = `${type}:${ip}`;
  const entry = rateMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateMap.set(key, { count: 1, resetAt: now + window });
    return false;
  }
  if (entry.count >= max) return true;
  entry.count++;
  return false;
}

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
export function middleware(request: NextRequest): NextResponse {
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
  const isAuthRoute = /^\/api\/auth\/(login|register|send-otp|verify-otp|reset-password)/.test(pathname);
  const isApiRoute  = pathname.startsWith("/api/");

  const limitType = isAuthRoute ? "auth" : isApiRoute ? "api" : "general";
  if (isRateLimited(ip, limitType)) {
    return block("Too many requests — please slow down", 429);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Skip Next.js internals and static assets
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
