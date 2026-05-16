import { withApi } from "@/lib/api/middleware";
import { VerifyOtpInputSchema } from "@/lib/api/schemas/auth";
import { verifyOtp } from "@/lib/api/handlers/auth/verify-otp";

export const POST = withApi(
  { schema: VerifyOtpInputSchema, auth: "public", name: "auth.verify-otp" },
  verifyOtp
);
