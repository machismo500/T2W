import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError } from "../../errors";
import { registerRoute } from "../../openapi/routes";
import { ErrorEnvelopeSchema } from "../../schemas/common";
import type { AuthedCtx } from "../../middleware";

const UnregisterDeviceResponseSchema = z
  .object({ ok: z.literal(true) })
  .openapi("UnregisterDeviceResponse");

registerRoute({
  method: "delete",
  path: "/api/v1/devices/{id}",
  summary: "Unregister a device",
  tags: ["devices"],
  security: ["bearer", "cookie"],
  responses: {
    200: { description: "Device unregistered", schema: UnregisterDeviceResponseSchema },
    401: { description: "Not authenticated", schema: ErrorEnvelopeSchema },
    404: { description: "Device not found or not owned by user", schema: ErrorEnvelopeSchema },
  },
});

export type UnregisterDeviceResponse = z.infer<typeof UnregisterDeviceResponseSchema>;

export async function unregisterDevice(deviceId: string, ctx: AuthedCtx): Promise<UnregisterDeviceResponse> {
  const device = await prisma.deviceToken.findUnique({ where: { id: deviceId } });
  if (!device || device.userId !== ctx.user.id) {
    throw new ApiError("NOT_FOUND", "Device not found");
  }
  await prisma.deviceToken.delete({ where: { id: deviceId } });
  return { ok: true };
}
