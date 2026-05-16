import { withApi } from "@/lib/api/middleware";
import { RegisterInputSchema } from "@/lib/api/schemas/auth";
import { register } from "@/lib/api/handlers/auth/register";

export const POST = withApi(
  { schema: RegisterInputSchema, auth: "public", name: "auth.register" },
  register
);
