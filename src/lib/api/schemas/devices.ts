import { z } from "./common";

export const PlatformSchema = z.enum(["ios", "android", "web"]).openapi("DevicePlatform");

export const DeviceSchema = z
  .object({
    id: z.string(),
    platform: PlatformSchema,
    pushToken: z.string().nullable(),
    deviceName: z.string().nullable(),
    lastSeenAt: z.string(),
    createdAt: z.string(),
  })
  .openapi("Device");

export const RegisterDeviceInputSchema = z
  .object({
    platform: PlatformSchema,
    pushToken: z.string().min(1).max(512).optional(),
    deviceName: z.string().min(1).max(120).optional(),
  })
  .openapi("RegisterDeviceInput");

export const RegisterDeviceResponseSchema = z
  .object({ device: DeviceSchema })
  .openapi("RegisterDeviceResponse");

export const DeviceListResponseSchema = z
  .object({ devices: z.array(DeviceSchema) })
  .openapi("DeviceListResponse");
