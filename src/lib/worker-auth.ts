import { timingSafeEqual } from "crypto";
import { NextRequest } from "next/server";

const HEADER_PREFIX = "Bearer ";

/**
 * True when the request carries the shared `RIDE_VIDEO_WORKER_SECRET`.
 *
 * The render worker lives outside this repo and has no user cookie. It
 * authenticates server-to-server with this bearer token to PATCH export
 * rows and upload the rendered MP4 / thumbnail to Vercel Blob via the
 * internal asset endpoint.
 *
 * Returns false (never throws) so callers can branch — if false, fall
 * through to the user-auth path.
 */
export function isWorkerRequest(req: NextRequest): boolean {
  const expected = process.env.RIDE_VIDEO_WORKER_SECRET;
  if (!expected) return false;
  const header = req.headers.get("authorization") || "";
  if (!header.startsWith(HEADER_PREFIX)) return false;
  const presented = header.slice(HEADER_PREFIX.length).trim();
  if (!presented) return false;
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
