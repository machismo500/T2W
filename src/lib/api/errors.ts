// Stable error shape for /api/v1 responses. Legacy /api/* routes keep their
// existing `{ error: string }` envelope; v1 always emits ErrorEnvelope.

export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "RIDE_FULL"
  | "RIDE_NOT_OPEN"
  | "REFRESH_REUSE"
  | "REFRESH_INVALID"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "BAD_REQUEST"
  | "INTERNAL";

const STATUS_FOR: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 400,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  RIDE_FULL: 409,
  RIDE_NOT_OPEN: 400,
  REFRESH_REUSE: 401,
  REFRESH_INVALID: 401,
  UNSUPPORTED_MEDIA_TYPE: 415,
  BAD_REQUEST: 400,
  INTERNAL: 500,
};

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = STATUS_FOR[code];
    this.details = details;
  }
}

export const unauthorized = (message = "Authentication required") =>
  new ApiError("UNAUTHORIZED", message);
export const forbidden = (message = "You don't have permission to do that") =>
  new ApiError("FORBIDDEN", message);
export const notFound = (message = "Not found") => new ApiError("NOT_FOUND", message);
export const conflict = (message: string) => new ApiError("CONFLICT", message);
export const badRequest = (message: string, details?: unknown) =>
  new ApiError("BAD_REQUEST", message, details);
export const validation = (message: string, details?: unknown) =>
  new ApiError("VALIDATION", message, details);
export const rateLimited = (message = "Too many requests — please slow down") =>
  new ApiError("RATE_LIMITED", message);
export const internal = (message = "Something went wrong") =>
  new ApiError("INTERNAL", message);
