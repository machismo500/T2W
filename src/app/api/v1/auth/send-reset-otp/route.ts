import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { createResetOtp } from "@/lib/otp-store";
import { apiError, apiOk } from "@/lib/api/v1/errors";
import { sendOtpEmail } from "@/lib/api/v1/email";

export async function POST(req: NextRequest) {
  try {
    const { email } = (await req.json()) as { email?: string };
    const emailLower = email?.toLowerCase().trim() ?? "";
    if (!emailLower) {
      return apiError("BAD_REQUEST", "Email is required");
    }

    const user = await prisma.user.findUnique({ where: { email: emailLower } });
    // Always return success to prevent account enumeration.
    if (!user) {
      return apiOk({ success: true, emailSent: false });
    }

    const code = await createResetOtp(emailLower);
    const result = await sendOtpEmail(emailLower, code, "reset", user.name);
    if (!result.ok) {
      if (result.reason === "not_configured") {
        return apiError(
          "EMAIL_SERVICE_DOWN",
          "Email service is not configured. Please contact support.",
        );
      }
      return apiError("SERVER_ERROR", `Failed to send email: ${result.message}`);
    }

    return apiOk({ success: true, emailSent: true });
  } catch (err) {
    console.error("[T2W][v1] send-reset-otp error:", err);
    return apiError("SERVER_ERROR", "Something went wrong");
  }
}
