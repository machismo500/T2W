import { NextRequest } from "next/server";
import { verifyEmailOtp } from "@/lib/otp-store";
import { apiError, apiOk } from "@/lib/api/v1/errors";

export async function POST(req: NextRequest) {
  try {
    const { email, code } = (await req.json()) as { email?: string; code?: string };
    if (!email || !code) {
      return apiError("BAD_REQUEST", "Email and code are required");
    }
    const valid = await verifyEmailOtp(email, code);
    if (!valid) {
      return apiError("UNPROCESSABLE", "Invalid or expired verification code");
    }
    return apiOk({ success: true, verified: true });
  } catch (err) {
    console.error("[T2W][v1] verify-otp error:", err);
    return apiError("SERVER_ERROR", "Something went wrong");
  }
}
