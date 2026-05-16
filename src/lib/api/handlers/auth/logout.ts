import { z } from "zod";
import { revokeRefreshToken, revokeAllForUser } from "../../auth/tokens";
import { LogoutInputSchema } from "../../schemas/auth";
import { registerRoute } from "../../openapi/routes";
import type { Ctx } from "../../middleware";

const LogoutResponseSchema = z.object({ ok: z.literal(true) }).openapi("LogoutResponse");

registerRoute({
  method: "post",
  path: "/api/v1/auth/logout",
  summary: "Revoke a refresh token (or all sessions if none provided + authed)",
  tags: ["auth"],
  security: ["bearer", "cookie"],
  request: { body: { schema: LogoutInputSchema } },
  responses: { 200: { description: "Logged out", schema: LogoutResponseSchema } },
});

export type LogoutInput = z.infer<typeof LogoutInputSchema>;
export type LogoutResponse = z.infer<typeof LogoutResponseSchema>;

export async function logout(input: LogoutInput, ctx: Ctx): Promise<LogoutResponse> {
  if (input.refreshToken) {
    await revokeRefreshToken(input.refreshToken);
  } else if (ctx.user) {
    await revokeAllForUser(ctx.user.id);
  }
  return { ok: true };
}
