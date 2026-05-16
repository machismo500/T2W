import { withApi } from "@/lib/api/middleware";
import { RegisterDeviceInputSchema } from "@/lib/api/schemas/devices";
import { registerDevice } from "@/lib/api/handlers/devices/register";

export const POST = withApi(
  { schema: RegisterDeviceInputSchema, auth: "required", name: "devices.register" },
  registerDevice
);
