import { z } from "zod";
import { withApi } from "@/lib/api/middleware";
import { sendOtp } from "@/lib/api/handlers/auth/send-otp";
import { EmailSchema } from "@/lib/api/schemas/common";

const SendResetOtpInputSchema = z.object({ email: EmailSchema });

export const POST = withApi(
  { schema: SendResetOtpInputSchema, auth: "public", name: "auth.send-reset-otp" },
  (input, ctx) => sendOtp({ email: input.email, purpose: "password_reset" }, ctx)
);
