import type { ZodTypeAny } from "zod";
import { registry } from "./registry";

type Method = "get" | "post" | "put" | "patch" | "delete";

type RegisterRouteInput = {
  method: Method;
  path: string;
  summary?: string;
  description?: string;
  tags?: string[];
  security?: ("bearer" | "cookie")[];
  request?: {
    body?: { schema: ZodTypeAny; description?: string; contentType?: string };
    query?: ZodTypeAny;
    params?: ZodTypeAny;
  };
  responses: Record<number, { description: string; schema?: ZodTypeAny }>;
};

export function registerRoute(input: RegisterRouteInput): void {
  const security =
    input.security && input.security.length > 0
      ? input.security.map((s) => ({ [s === "bearer" ? "BearerAuth" : "CookieAuth"]: [] }))
      : undefined;

  const responses: Record<number, { description: string; content?: Record<string, { schema: ZodTypeAny }> }> = {};
  for (const [status, def] of Object.entries(input.responses)) {
    responses[Number(status)] = def.schema
      ? {
          description: def.description,
          content: { "application/json": { schema: def.schema } },
        }
      : { description: def.description };
  }

  // The zod-to-openapi registerPath signature uses narrower types
  // (RouteParameter / ZodObjectWithEffect) than ZodTypeAny; cast at the
  // boundary to keep our public API ergonomic.
  const request = input.request
    ? {
        ...(input.request.body
          ? {
              body: {
                description: input.request.body.description,
                content: {
                  [input.request.body.contentType ?? "application/json"]: {
                    schema: input.request.body.schema,
                  },
                },
              },
            }
          : {}),
        ...(input.request.query ? { query: input.request.query } : {}),
        ...(input.request.params ? { params: input.request.params } : {}),
      }
    : undefined;

  registry.registerPath({
    method: input.method,
    path: input.path,
    summary: input.summary,
    description: input.description,
    tags: input.tags,
    security,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    request: request as any,
    responses,
  });
}
