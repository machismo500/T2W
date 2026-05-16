import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { ApiError } from "../../errors";
import {
  issueAccessToken,
  issueRefreshToken,
  storeRefreshToken,
} from "../../auth/tokens";
import {
  RegisterInputSchema,
  LoginResponseSchema,
} from "../../schemas/auth";
import { registerRoute } from "../../openapi/routes";
import { ErrorEnvelopeSchema } from "../../schemas/common";
import type { Ctx } from "../../middleware";

registerRoute({
  method: "post",
  path: "/api/v1/auth/register",
  summary: "Create a new rider account",
  tags: ["auth"],
  request: { body: { schema: RegisterInputSchema } },
  responses: {
    200: { description: "Account created + tokens", schema: LoginResponseSchema },
    409: { description: "Email already registered", schema: ErrorEnvelopeSchema },
    400: { description: "Validation error", schema: ErrorEnvelopeSchema },
  },
});

export type RegisterInput = z.infer<typeof RegisterInputSchema>;
export type RegisterResponse = z.infer<typeof LoginResponseSchema>;

export async function register(input: RegisterInput, ctx: Ctx): Promise<RegisterResponse> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new ApiError("CONFLICT", "An account with this email already exists");
  }

  const hashedPassword = await hashPassword(input.password);

  // Reuse rider-profile linking logic from the legacy /api/auth/register flow.
  const existingProfile = await prisma.riderProfile.findFirst({
    where: { email: input.email, mergedIntoId: null },
    include: { participations: { include: { ride: { select: { distanceKm: true } } } } },
  });

  const totalKm = existingProfile
    ? existingProfile.participations.reduce((sum, p) => sum + p.ride.distanceKm, 0)
    : 0;
  const ridesCompleted = existingProfile ? existingProfile.participations.length : 0;

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      password: hashedPassword,
      phone: input.phone ?? null,
      city: input.city ?? null,
      ridingExperience: input.ridingExperience ?? null,
      role: "rider",
      isApproved: false,
      linkedRiderId: existingProfile?.id ?? null,
      totalKm,
      ridesCompleted,
    },
  });

  if (!existingProfile) {
    const newProfile = await prisma.riderProfile.create({
      data: { name: input.name, email: input.email, phone: input.phone ?? "" },
    });
    await prisma.user.update({
      where: { id: user.id },
      data: { linkedRiderId: newProfile.id },
    });
  }

  if (input.motorcycle) {
    await prisma.motorcycle.create({
      data: {
        make: input.motorcycle,
        model: "",
        year: new Date().getFullYear(),
        cc: 0,
        color: "",
        userId: user.id,
      },
    });
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

  const fresh = await prisma.user.findUnique({ where: { id: user.id } });

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: fresh?.role ?? "rider",
      isApproved: fresh?.isApproved ?? false,
      avatar: fresh?.avatar ?? null,
      city: fresh?.city ?? null,
      totalKm: fresh?.totalKm ?? totalKm,
      ridesCompleted: fresh?.ridesCompleted ?? ridesCompleted,
      linkedRiderId: fresh?.linkedRiderId ?? null,
    },
    tokens: {
      accessToken: access.token,
      refreshToken: refresh.token,
      expiresAt: access.expiresAt.toISOString(),
      refreshExpiresAt: refresh.expiresAt.toISOString(),
    },
  };
}
