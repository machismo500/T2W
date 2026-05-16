import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { isResetVerified, clearResetVerified } from "@/lib/otp-store";
import { ApiError } from "../../errors";
import { ResetPasswordInputSchema } from "../../schemas/auth";
import { registerRoute } from "../../openapi/routes";
import { ErrorEnvelopeSchema } from "../../schemas/common";
import { revokeAllForUser } from "../../auth/tokens";
import type { Ctx } from "../../middleware";

const ResetPasswordResponseSchema = z
  .object({ ok: z.literal(true) })
  .openapi("ResetPasswordResponse");

registerRoute({
  method: "post",
  path: "/api/v1/auth/reset-password",
  summary: "Set a new password (after verifying a reset OTP)",
  tags: ["auth"],
  request: { body: { schema: ResetPasswordInputSchema } },
  responses: {
    200: { description: "Password updated", schema: ResetPasswordResponseSchema },
    403: { description: "Reset session expired or not verified", schema: ErrorEnvelopeSchema },
    404: { description: "Account not found", schema: ErrorEnvelopeSchema },
  },
});

export type ResetPasswordInput = z.infer<typeof ResetPasswordInputSchema>;
export type ResetPasswordResponse = z.infer<typeof ResetPasswordResponseSchema>;

export async function resetPassword(input: ResetPasswordInput, _ctx: Ctx): Promise<ResetPasswordResponse> {
  if (!(await isResetVerified(input.email))) {
    throw new ApiError("FORBIDDEN", "Reset session expired. Please start over.");
  }
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) throw new ApiError("NOT_FOUND", "No account found with this email");

  const hashed = await hashPassword(input.password);
  await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });
  await clearResetVerified(input.email);
  // Invalidate all existing mobile sessions on password change.
  await revokeAllForUser(user.id);

  return { ok: true };
}
