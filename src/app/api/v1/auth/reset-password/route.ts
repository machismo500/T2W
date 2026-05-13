import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { isResetVerified, clearResetVerified } from "@/lib/otp-store";
import { apiError, apiOk } from "@/lib/api/v1/errors";
import { revokeAllForUser } from "@/lib/api/v1/tokens";

export async function POST(req: NextRequest) {
  try {
    const { email, newPassword } = (await req.json()) as {
      email?: string;
      newPassword?: string;
    };
    const emailLower = email?.toLowerCase().trim() ?? "";
    if (!emailLower || !newPassword) {
      return apiError("BAD_REQUEST", "Email and new password are required");
    }
    if (newPassword.length < 12) {
      return apiError("BAD_REQUEST", "Password must be at least 12 characters");
    }
    if (!(await isResetVerified(emailLower))) {
      return apiError("FORBIDDEN", "Reset session expired. Please start over.");
    }

    const user = await prisma.user.findUnique({ where: { email: emailLower } });
    if (!user) {
      return apiError("NOT_FOUND", "No account found with this email");
    }

    const hashed = await hashPassword(newPassword);
    await prisma.user.update({ where: { email: emailLower }, data: { password: hashed } });
    await clearResetVerified(emailLower);
    // Security: revoke all refresh tokens after a password reset.
    await revokeAllForUser(user.id);

    return apiOk({ success: true });
  } catch (err) {
    console.error("[T2W][v1] reset-password error:", err);
    return apiError("SERVER_ERROR", "Something went wrong");
  }
}
