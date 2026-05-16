import type { NextRequest } from "next/server";
import type { ZodType, ZodTypeAny, ZodTypeDef } from "zod";
import { ApiError, badRequest, validation } from "./errors";

function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}

// `ZodType<T, ZodTypeDef, unknown>` accepts schemas whose input shape differs
// from their output shape (e.g. those with `.default(...)` or `.transform(...)`).
type ParseSchema<T> = ZodType<T, ZodTypeDef, unknown>;

export async function parseJson<T>(
  request: NextRequest,
  schema: ParseSchema<T>
): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw badRequest("Request body must be valid JSON");
  }
  return parseWith(schema, raw);
}

export function parseQuery<T>(
  request: NextRequest,
  schema: ParseSchema<T>
): T {
  const obj: Record<string, string | string[]> = {};
  request.nextUrl.searchParams.forEach((value, key) => {
    const existing = obj[key];
    if (existing === undefined) {
      obj[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      obj[key] = [existing, value];
    }
  });
  return parseWith(schema, obj);
}

export function parseWith<T>(schema: ParseSchema<T>, raw: unknown): T {
  const result = (schema as ZodTypeAny).safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((i) => ({
      path: i.path.join("."),
      message: i.message,
    }));
    throw validation("Request validation failed", issues);
  }
  return result.data as T;
}

export function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

export { isApiError };
