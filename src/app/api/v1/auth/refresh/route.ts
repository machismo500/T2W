import { withApi } from "@/lib/api/middleware";
import { RefreshInputSchema } from "@/lib/api/schemas/auth";
import { refresh } from "@/lib/api/handlers/auth/refresh";

export const POST = withApi(
  { schema: RefreshInputSchema, auth: "public", name: "auth.refresh" },
  refresh
);
