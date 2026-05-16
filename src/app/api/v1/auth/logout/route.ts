import { withApi } from "@/lib/api/middleware";
import { LogoutInputSchema } from "@/lib/api/schemas/auth";
import { logout } from "@/lib/api/handlers/auth/logout";

export const POST = withApi(
  { schema: LogoutInputSchema, auth: "optional", name: "auth.logout" },
  logout
);
