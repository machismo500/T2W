import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api/v1/errors";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  createAccessToken,
  rotateRefreshToken,
} from "@/lib/api/v1/tokens";

export async function POST(req: NextRequest) {
  try {
    const { refreshToken } = (await req.json()) as { refreshToken?: string };
    if (!refreshToken) {
      return apiError("BAD_REQUEST", "refreshToken is required");
    }

    const result = await rotateRefreshToken(refreshToken);
    if (result.kind === "invalid" || result.kind === "expired") {
      return apiError("INVALID_TOKEN", "Refresh token is invalid or expired");
    }
    if (result.kind === "reused") {
      return apiError(
        "TOKEN_REUSED",
        "Refresh token reuse detected — all sessions for this account have been revoked.",
      );
    }

    const accessToken = await createAccessToken(result.userId);
    return apiOk({
      accessToken,
      accessTokenExpiresIn: ACCESS_TOKEN_TTL_SECONDS,
      refreshToken: result.refresh.token,
      refreshTokenExpiresAt: result.refresh.expiresAt.toISOString(),
    });
  } catch (err) {
    console.error("[T2W][v1] refresh error:", err);
    return apiError("SERVER_ERROR", "Something went wrong");
  }
}
