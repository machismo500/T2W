import { NextRequest, NextResponse } from "next/server";
import { verifyEmailOtp } from "@/lib/otp-store";

export async function POST(req: NextRequest) {
  try {
    const { email, code } = await req.json();

    if (!email || !code) {
      return NextResponse.json(
        { error: "Email and code are required" },
        { status: 400 }
      );
    }

    const valid = await verifyEmailOtp(email, code);
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid or expired verification code" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, verified: true });
  } catch (error) {
    console.error("[T2W] Verify OTP error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
