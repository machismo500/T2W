import { z } from "zod";
import { rotateRefreshToken } from "../../auth/tokens";
import {
  RefreshInputSchema,
  RefreshResponseSchema,
} from "../../schemas/auth";
import { registerRoute } from "../../openapi/routes";
import { ErrorEnvelopeSchema } from "../../schemas/common";
import type { Ctx } from "../../middleware";

registerRoute({
  method: "post",
  path: "/api/v1/auth/refresh",
  summary: "Rotate a refresh token (with reuse detection)",
  tags: ["auth"],
  request: { body: { schema: RefreshInputSchema } },
  responses: {
    200: { description: "New token pair", schema: RefreshResponseSchema },
    401: { description: "Refresh token invalid, revoked, or reused", schema: ErrorEnvelopeSchema },
  },
});

export type RefreshInput = z.infer<typeof RefreshInputSchema>;
export type RefreshResponse = z.infer<typeof RefreshResponseSchema>;

export async function refresh(input: RefreshInput, ctx: Ctx): Promise<RefreshResponse> {
  const rotated = await rotateRefreshToken(input.refreshToken, {
    ip: ctx.ip,
    userAgent: undefined,
  });
  return {
    tokens: {
      accessToken: rotated.access.token,
      refreshToken: rotated.refresh.token,
      expiresAt: rotated.access.expiresAt.toISOString(),
      refreshExpiresAt: rotated.refresh.expiresAt.toISOString(),
    },
  };
}
