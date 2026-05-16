import { withApi } from "@/lib/api/middleware";
import { LoginInputSchema } from "@/lib/api/schemas/auth";
import { login } from "@/lib/api/handlers/auth/login";

export const POST = withApi(
  { schema: LoginInputSchema, auth: "public", name: "auth.login" },
  login
);
