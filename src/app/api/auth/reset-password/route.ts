import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { isResetVerified, clearResetVerified } from "@/lib/otp-store";

export async function POST(req: NextRequest) {
  try {
    const { email, newPassword } = await req.json();
    const emailLower = (email || "").toLowerCase().trim();

    if (!emailLower || !newPassword) {
      return NextResponse.json(
        { error: "Email and new password are required" },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    // Check that the OTP was verified
    if (!(await isResetVerified(emailLower))) {
      return NextResponse.json(
        { error: "Reset session expired. Please start over." },
        { status: 403 }
      );
    }

    const user = await prisma.user.findUnique({ where: { email: emailLower } });
    if (!user) {
      return NextResponse.json(
        { error: "No account found with this email" },
        { status: 404 }
      );
    }

    const hashedPassword = await hashPassword(newPassword);
    await prisma.user.update({
      where: { email: emailLower },
      data: { password: hashedPassword },
    });

    await clearResetVerified(emailLower);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[T2W] Reset password error:", message, error);
    return NextResponse.json(
      { error: message || "Something went wrong" },
      { status: 500 }
    );
  }
}
