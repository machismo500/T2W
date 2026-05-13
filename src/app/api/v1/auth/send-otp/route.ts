import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { createEmailOtp } from "@/lib/otp-store";
import { apiError, apiOk } from "@/lib/api/v1/errors";
import { sendOtpEmail } from "@/lib/api/v1/email";

export async function POST(req: NextRequest) {
  try {
    const { email } = (await req.json()) as { email?: string };
    const emailLower = email?.toLowerCase().trim() ?? "";

    if (!emailLower || !emailLower.includes("@")) {
      return apiError("BAD_REQUEST", "Please enter a valid email address");
    }

    const existing = await prisma.user.findUnique({ where: { email: emailLower } });
    if (existing) {
      return apiError("ALREADY_REGISTERED", "An account with this email already exists");
    }

    const code = await createEmailOtp(emailLower);
    const result = await sendOtpEmail(emailLower, code, "verify");
    if (!result.ok) {
      if (result.reason === "not_configured") {
        return apiError(
          "EMAIL_SERVICE_DOWN",
          "Email service is not configured. Please contact support.",
        );
      }
      return apiError("SERVER_ERROR", `Failed to send verification email: ${result.message}`);
    }

    return apiOk({ success: true });
  } catch (err) {
    console.error("[T2W][v1] send-otp error:", err);
    return apiError("SERVER_ERROR", "Something went wrong");
  }
}
