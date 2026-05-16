import { withApi } from "@/lib/api/middleware";
import { SendOtpInputSchema } from "@/lib/api/schemas/auth";
import { sendOtp } from "@/lib/api/handlers/auth/send-otp";

export const POST = withApi(
  { schema: SendOtpInputSchema, auth: "public", name: "auth.send-otp" },
  sendOtp
);
