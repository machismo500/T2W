import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import { ApiError } from "../../errors";
import {
  issueAccessToken,
  issueRefreshToken,
  storeRefreshToken,
} from "../../auth/tokens";
import { LoginInputSchema, LoginResponseSchema } from "../../schemas/auth";
import { registerRoute } from "../../openapi/routes";
import { ErrorEnvelopeSchema } from "../../schemas/common";
import type { Ctx } from "../../middleware";

registerRoute({
  method: "post",
  path: "/api/v1/auth/login",
  summary: "Authenticate with email + password",
  tags: ["auth"],
  request: { body: { schema: LoginInputSchema } },
  responses: {
    200: { description: "Tokens + user", schema: LoginResponseSchema },
    401: { description: "Invalid credentials", schema: ErrorEnvelopeSchema },
    400: { description: "Validation error", schema: ErrorEnvelopeSchema },
  },
});

export type LoginInput = z.infer<typeof LoginInputSchema>;
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

export async function login(input: LoginInput, ctx: Ctx): Promise<LoginResponse> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (!user) throw new ApiError("UNAUTHORIZED", "Invalid email or password");
  if (!(await verifyPassword(input.password, user.password))) {
    throw new ApiError("UNAUTHORIZED", "Invalid email or password");
  }

  const access = await issueAccessToken(user.id, input.deviceId);
  const refresh = issueRefreshToken();
  await storeRefreshToken({
    userId: user.id,
    hash: refresh.hash,
    expiresAt: refresh.expiresAt,
    deviceId: input.deviceId,
    ip: ctx.ip,
  });

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isApproved: user.isApproved,
      avatar: user.avatar,
      city: user.city,
      totalKm: user.totalKm,
      ridesCompleted: user.ridesCompleted,
      linkedRiderId: user.linkedRiderId,
    },
    tokens: {
      accessToken: access.token,
      refreshToken: refresh.token,
      expiresAt: access.expiresAt.toISOString(),
      refreshExpiresAt: refresh.expiresAt.toISOString(),
    },
  };
}
