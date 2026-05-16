import { withApi, type AuthedCtx } from "@/lib/api/middleware";
import { me } from "@/lib/api/handlers/auth/me";

export const GET = withApi(
  { auth: "required", name: "auth.me" },
  (_input: unknown, ctx: AuthedCtx) => me(undefined, ctx)
);
