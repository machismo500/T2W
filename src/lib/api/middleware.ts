import type { NextRequest, NextResponse } from "next/server";
import type { ZodType, ZodTypeDef } from "zod";
import { ApiError, internal, unauthorized } from "./errors";
import { error as errorResponse, ok } from "./responses";
import { getAuthContext, makeRequestMeta, type SafeUser } from "./auth/context";
import { parseJson, parseQuery } from "./request";
import { prisma } from "@/lib/db";
import { log } from "./log";

export type AuthMode = "required" | "optional" | "public";
export type RequestSource = "json" | "query" | "none";

export type Ctx = {
  user?: SafeUser;
  db: typeof prisma;
  source: "cookie" | "bearer" | "public";
  requestId: string;
  ip: string;
};
export type AuthedCtx = Ctx & { user: SafeUser };

// `ZodType<I, ZodTypeDef, any>` lets schemas with `.default(...)` work: the
// input shape (what the client sends) may be a subset of the output shape
// (what the handler receives after parsing).
type AnyZodSchema<I> = ZodType<I, ZodTypeDef, unknown>;

type Options<I> = {
  schema?: AnyZodSchema<I>;
  auth: AuthMode;
  source?: RequestSource;
  name?: string;
};

function defaultSource(method: string): RequestSource {
  return ["POST", "PUT", "PATCH"].includes(method.toUpperCase()) ? "json" : "query";
}

function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}

/**
 * Low-level entry point. Path-param routes use this directly so they can
 * close over the resolved params; simple routes use the `withApi` sugar
 * wrapper below.
 */
export async function runApi<I, O>(
  request: NextRequest,
  opts: Options<I>,
  invoke: (input: I, ctx: Ctx) => Promise<O>
): Promise<NextResponse> {
  const start = Date.now();
  const meta = makeRequestMeta(request);
  const requestId = meta.requestId;
  const name = opts.name ?? "handler";

  try {
    const auth = await getAuthContext(request);
    if (opts.auth === "required" && !auth) {
      throw unauthorized();
    }

    const source =
      opts.source ?? (opts.schema ? defaultSource(request.method) : "none");
    let input: unknown = undefined;
    if (opts.schema) {
      if (source === "json") input = await parseJson(request, opts.schema);
      else if (source === "query") input = parseQuery(request, opts.schema);
    }

    const ctx: Ctx = {
      user: auth?.user,
      db: prisma,
      source: auth ? auth.source : "public",
      requestId,
      ip: meta.ip,
    };

    const result = await invoke(input as I, ctx);
    const durationMs = Date.now() - start;
    log.info("api.ok", {
      requestId,
      userId: auth?.user.id,
      handler: name,
      durationMs,
      status: 200,
    });
    return ok(result, requestId);
  } catch (err) {
    const durationMs = Date.now() - start;
    const apiErr = isApiError(err)
      ? err
      : (() => {
          log.error("api.unhandled", {
            requestId,
            handler: name,
            durationMs,
            error: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
          });
          return internal();
        })();

    log.warn("api.error", {
      requestId,
      handler: name,
      durationMs,
      code: apiErr.code,
      status: apiErr.status,
    });
    return errorResponse(apiErr, requestId);
  }
}

/**
 * Sugar wrapper for routes WITHOUT path params. Returns a Next.js-style
 * route handler that calls the supplied business handler.
 *
 * Implementation note: the two overloads diverge in their `ctx` parameter
 * (AuthedCtx vs Ctx), which is contravariant and so doesn't unify under a
 * single implementation signature. The implementation accepts a generic
 * handler and casts internally — the runtime guarantee is that `runApi`
 * only calls the handler with an AuthedCtx when `auth: "required"`.
 */
export function withApi<I, O>(
  opts: Options<I> & { auth: "required" },
  handler: (input: I, ctx: AuthedCtx) => Promise<O>
): (request: NextRequest) => Promise<NextResponse>;
export function withApi<I, O>(
  opts: Options<I> & { auth: "optional" | "public" },
  handler: (input: I, ctx: Ctx) => Promise<O>
): (request: NextRequest) => Promise<NextResponse>;
export function withApi(
  opts: Options<unknown>,
  handler: (input: unknown, ctx: AuthedCtx) => Promise<unknown>
): (request: NextRequest) => Promise<NextResponse> {
  return (request: NextRequest) =>
    runApi(request, opts, (input, ctx) => handler(input, ctx as AuthedCtx));
}
