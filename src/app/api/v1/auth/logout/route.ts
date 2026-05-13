import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api/v1/errors";
import { requireBearer } from "@/lib/api/v1/auth-guard";
import { revokeAllForUser, revokeRefreshToken } from "@/lib/api/v1/tokens";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireBearer(req);
    if (!auth.ok) {
      return apiError("UNAUTHORIZED", "Authentication required");
    }

    const body = (await req.json().catch(() => ({}))) as {
      refreshToken?: string;
      allDevices?: boolean;
    };

    if (body.allDevices) {
      await revokeAllForUser(auth.user.id);
    } else if (body.refreshToken) {
      await revokeRefreshToken(body.refreshToken);
    }

    return apiOk({ success: true });
  } catch (err) {
    console.error("[T2W][v1] logout error:", err);
    return apiError("SERVER_ERROR", "Something went wrong");
  }
}
