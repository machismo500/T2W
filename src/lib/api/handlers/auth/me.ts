import { z } from "zod";
import { MeResponseSchema } from "../../schemas/auth";
import { registerRoute } from "../../openapi/routes";
import { ErrorEnvelopeSchema } from "../../schemas/common";
import type { AuthedCtx } from "../../middleware";

registerRoute({
  method: "get",
  path: "/api/v1/auth/me",
  summary: "Return the authenticated user",
  tags: ["auth"],
  security: ["bearer", "cookie"],
  responses: {
    200: { description: "Authenticated user", schema: MeResponseSchema },
    401: { description: "Not authenticated", schema: ErrorEnvelopeSchema },
  },
});

export type MeResponse = z.infer<typeof MeResponseSchema>;

export async function me(_input: undefined, ctx: AuthedCtx): Promise<MeResponse> {
  return { user: ctx.user };
}
