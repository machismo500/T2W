import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "UNPROCESSABLE"
  | "RATE_LIMITED"
  | "SERVER_ERROR"
  | "EMAIL_SERVICE_DOWN"
  | "INVALID_CREDENTIALS"
  | "INVALID_TOKEN"
  | "TOKEN_REUSED"
  | "RIDE_FULL"
  | "ALREADY_REGISTERED";

const STATUS: Record<ApiErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE: 422,
  RATE_LIMITED: 429,
  SERVER_ERROR: 500,
  EMAIL_SERVICE_DOWN: 503,
  INVALID_CREDENTIALS: 401,
  INVALID_TOKEN: 401,
  TOKEN_REUSED: 401,
  RIDE_FULL: 409,
  ALREADY_REGISTERED: 409,
};

export function apiError(
  code: ApiErrorCode,
  message: string,
  details?: Record<string, unknown>,
) {
  return NextResponse.json(
    { error: { code, message, ...(details ? { details } : {}) } },
    { status: STATUS[code] },
  );
}

export function apiOk<T>(data: T, init?: { status?: number }) {
  return NextResponse.json(data, { status: init?.status ?? 200 });
}
