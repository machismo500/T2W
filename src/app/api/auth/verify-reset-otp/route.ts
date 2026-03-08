import { NextRequest, NextResponse } from "next/server";
import { verifyResetOtp } from "@/lib/otp-store";

export async function POST(req: NextRequest) {
  try {
    const { email, code } = await req.json();

    if (!email || !code) {
      return NextResponse.json(
        { error: "Email and code are required" },
        { status: 400 }
      );
    }

    const valid = await verifyResetOtp(email, code);
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid or expired reset code" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[T2W] Verify reset OTP error:", message, error);
    return NextResponse.json(
      { error: message || "Something went wrong" },
      { status: 500 }
    );
  }
}
