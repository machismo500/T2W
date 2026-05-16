import type { NextRequest } from "next/server";
import { runApi, type AuthedCtx } from "@/lib/api/middleware";
import { unregisterDevice } from "@/lib/api/handlers/devices/unregister";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return runApi(
    request,
    { auth: "required", name: "devices.unregister" },
    (_input, ctx) => unregisterDevice(id, ctx as AuthedCtx)
  );
}
