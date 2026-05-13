import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { apiError, apiOk } from "@/lib/api/v1/errors";
import { requireBearer } from "@/lib/api/v1/auth-guard";

type RegisterBody = {
  token?: string;
  platform?: "ios" | "android";
  deviceId?: string;
  appBuild?: string;
};

// Register or refresh a push notification token for the current device.
export async function POST(req: NextRequest) {
  const auth = await requireBearer(req);
  if (!auth.ok) {
    return apiError("UNAUTHORIZED", "Authentication required");
  }

  const body = (await req.json()) as RegisterBody;
  if (!body.token || !body.platform || !body.deviceId) {
    return apiError("BAD_REQUEST", "token, platform and deviceId are required");
  }
  if (body.platform !== "ios" && body.platform !== "android") {
    return apiError("BAD_REQUEST", "platform must be ios or android");
  }

  const record = await prisma.deviceToken.upsert({
    where: { userId_deviceId: { userId: auth.user.id, deviceId: body.deviceId } },
    create: {
      userId: auth.user.id,
      token: body.token,
      platform: body.platform,
      deviceId: body.deviceId,
      appBuild: body.appBuild ?? null,
    },
    update: {
      token: body.token,
      platform: body.platform,
      appBuild: body.appBuild ?? null,
    },
  });

  return apiOk({ id: record.id });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireBearer(req);
  if (!auth.ok) {
    return apiError("UNAUTHORIZED", "Authentication required");
  }

  const { searchParams } = req.nextUrl;
  const deviceId = searchParams.get("deviceId");
  if (!deviceId) {
    return apiError("BAD_REQUEST", "deviceId is required");
  }

  await prisma.deviceToken.deleteMany({
    where: { userId: auth.user.id, deviceId },
  });

  return apiOk({ success: true });
}
