import { NextRequest, NextResponse } from "next/server";

/**
 * Middleware to enforce HTTPS in production.
 * Redirects any plain HTTP request to its HTTPS equivalent.
 */
export function middleware(request: NextRequest) {
  // Redirect HTTP → HTTPS in production
  const proto = request.headers.get("x-forwarded-proto");
  if (
    proto === "http" &&
    process.env.NODE_ENV === "production" &&
    !request.nextUrl.hostname.includes("localhost")
  ) {
    const httpsUrl = request.nextUrl.clone();
    httpsUrl.protocol = "https:";
    return NextResponse.redirect(httpsUrl, 301);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths except static files and Next.js internals
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
