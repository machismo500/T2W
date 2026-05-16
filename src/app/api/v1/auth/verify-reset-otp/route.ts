import { z } from "zod";
import { withApi } from "@/lib/api/middleware";
import { verifyOtp } from "@/lib/api/handlers/auth/verify-otp";
import { EmailSchema } from "@/lib/api/schemas/common";

const VerifyResetOtpInputSchema = z.object({
  email: EmailSchema,
  code: z.string().min(4).max(10),
});

export const POST = withApi(
  { schema: VerifyResetOtpInputSchema, auth: "public", name: "auth.verify-reset-otp" },
  (input, ctx) => verifyOtp({ ...input, purpose: "password_reset" }, ctx)
);
