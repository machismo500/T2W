import { withApi } from "@/lib/api/middleware";
import { ResetPasswordInputSchema } from "@/lib/api/schemas/auth";
import { resetPassword } from "@/lib/api/handlers/auth/reset-password";

export const POST = withApi(
  { schema: ResetPasswordInputSchema, auth: "public", name: "auth.reset-password" },
  resetPassword
);
