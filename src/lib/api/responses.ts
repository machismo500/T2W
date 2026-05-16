import { NextResponse } from "next/server";
import { ApiError, type ErrorCode } from "./errors";

export type ErrorEnvelope = {
  error: { code: ErrorCode; message: string; details?: unknown };
  requestId: string;
};

export type PaginatedEnvelope<T> = {
  data: T[];
  pageInfo: { nextCursor: string | null };
};

function withRequestId(res: NextResponse, requestId: string): NextResponse {
  res.headers.set("x-request-id", requestId);
  return res;
}

export function ok<T>(
  data: T,
  requestId: string,
  init?: { status?: number; headers?: HeadersInit }
): NextResponse {
  const res = NextResponse.json(data, {
    status: init?.status ?? 200,
    headers: init?.headers,
  });
  return withRequestId(res, requestId);
}

export function created<T>(
  data: T,
  requestId: string,
  location?: string
): NextResponse {
  const headers: HeadersInit = location ? { Location: location } : {};
  const res = NextResponse.json(data, { status: 201, headers });
  return withRequestId(res, requestId);
}

export function noContent(requestId: string): NextResponse {
  const res = new NextResponse(null, { status: 204 });
  return withRequestId(res, requestId);
}

export function paginated<T>(
  items: T[],
  nextCursor: string | null,
  requestId: string
): NextResponse {
  return ok<PaginatedEnvelope<T>>({ data: items, pageInfo: { nextCursor } }, requestId);
}

export function error(err: ApiError, requestId: string): NextResponse {
  const body: ErrorEnvelope = {
    error: { code: err.code, message: err.message, details: err.details },
    requestId,
  };
  const res = NextResponse.json(body, { status: err.status });
  return withRequestId(res, requestId);
}

// Backward-compat helper for legacy `/api/*` routes: preserves the old
// `{ error: string }` shape while letting the route still throw ApiError.
export function legacyError(err: ApiError): NextResponse {
  return NextResponse.json({ error: err.message }, { status: err.status });
}
