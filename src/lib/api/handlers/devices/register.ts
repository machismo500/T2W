import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  RegisterDeviceInputSchema,
  RegisterDeviceResponseSchema,
} from "../../schemas/devices";
import { registerRoute } from "../../openapi/routes";
import { ErrorEnvelopeSchema } from "../../schemas/common";
import type { AuthedCtx } from "../../middleware";

registerRoute({
  method: "post",
  path: "/api/v1/devices",
  summary: "Register or update a device push token",
  tags: ["devices"],
  security: ["bearer", "cookie"],
  request: { body: { schema: RegisterDeviceInputSchema } },
  responses: {
    200: { description: "Device registered", schema: RegisterDeviceResponseSchema },
    401: { description: "Not authenticated", schema: ErrorEnvelopeSchema },
  },
});

export type RegisterDeviceInput = z.infer<typeof RegisterDeviceInputSchema>;
export type RegisterDeviceResponse = z.infer<typeof RegisterDeviceResponseSchema>;

export async function registerDevice(
  input: RegisterDeviceInput,
  ctx: AuthedCtx
): Promise<RegisterDeviceResponse> {
  // Upsert by (userId, pushToken) — same physical device re-registering replaces metadata.
  const existing = input.pushToken
    ? await prisma.deviceToken.findFirst({
        where: { userId: ctx.user.id, pushToken: input.pushToken },
      })
    : null;

  const device = existing
    ? await prisma.deviceToken.update({
        where: { id: existing.id },
        data: {
          platform: input.platform,
          deviceName: input.deviceName ?? existing.deviceName,
          lastSeenAt: new Date(),
        },
      })
    : await prisma.deviceToken.create({
        data: {
          userId: ctx.user.id,
          platform: input.platform,
          pushToken: input.pushToken ?? null,
          deviceName: input.deviceName ?? null,
        },
      });

  return {
    device: {
      id: device.id,
      platform: device.platform as RegisterDeviceResponse["device"]["platform"],
      pushToken: device.pushToken,
      deviceName: device.deviceName,
      lastSeenAt: device.lastSeenAt.toISOString(),
      createdAt: device.createdAt.toISOString(),
    },
  };
}
