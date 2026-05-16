import { z } from "zod";
import { verifyEmailOtp, verifyResetOtp } from "@/lib/otp-store";
import { ApiError } from "../../errors";
import { VerifyOtpInputSchema } from "../../schemas/auth";
import { registerRoute } from "../../openapi/routes";
import { ErrorEnvelopeSchema } from "../../schemas/common";
import type { Ctx } from "../../middleware";

const VerifyOtpResponseSchema = z
  .object({ ok: z.literal(true), verified: z.literal(true) })
  .openapi("VerifyOtpResponse");

registerRoute({
  method: "post",
  path: "/api/v1/auth/verify-otp",
  summary: "Verify a one-time code",
  tags: ["auth"],
  request: { body: { schema: VerifyOtpInputSchema } },
  responses: {
    200: { description: "Code verified", schema: VerifyOtpResponseSchema },
    400: { description: "Invalid or expired code", schema: ErrorEnvelopeSchema },
  },
});

export type VerifyOtpInput = z.infer<typeof VerifyOtpInputSchema>;
export type VerifyOtpResponse = z.infer<typeof VerifyOtpResponseSchema>;

export async function verifyOtp(input: VerifyOtpInput, _ctx: Ctx): Promise<VerifyOtpResponse> {
  const valid =
    input.purpose === "email_verify"
      ? await verifyEmailOtp(input.email, input.code)
      : await verifyResetOtp(input.email, input.code);
  if (!valid) throw new ApiError("BAD_REQUEST", "Invalid or expired verification code");
  return { ok: true, verified: true };
}
