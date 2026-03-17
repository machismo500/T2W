import { NextRequest, NextResponse } from "next/server";

/**
 * Middleware to enforce HTTPS in production and add www → apex redirect.
 * Handles x-forwarded-proto (Vercel, reverse proxies) and direct HTTP detection.
 */
export function middleware(request: NextRequest) {
  const host = request.headers.get("host") || request.nextUrl.hostname;
  const isLocalhost = host.includes("localhost") || host.includes("127.0.0.1");

  if (process.env.NODE_ENV === "production" && !isLocalhost) {
    // Detect HTTP via x-forwarded-proto or x-forwarded-ssl or scheme
    const proto = request.headers.get("x-forwarded-proto");
    const forwardedSsl = request.headers.get("x-forwarded-ssl");
    const isHttp =
      proto === "http" ||
      forwardedSsl === "off" ||
      request.nextUrl.protocol === "http:";

    if (isHttp) {
      const httpsUrl = request.nextUrl.clone();
      httpsUrl.protocol = "https:";
      httpsUrl.port = "";
      return NextResponse.redirect(httpsUrl, 301);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths except static files and Next.js internals
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
