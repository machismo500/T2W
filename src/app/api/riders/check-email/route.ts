import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// POST /api/riders/check-email - check if email exists in rider DB or user DB
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user account exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, name: true },
    });

    // Check if rider profile exists
    const existingProfile = await prisma.riderProfile.findFirst({
      where: { email: normalizedEmail, mergedIntoId: null },
      select: { id: true, name: true },
    });

    return NextResponse.json({
      hasAccount: !!existingUser,
      hasRiderProfile: !!existingProfile,
      riderProfileName: existingProfile?.name || null,
      userName: existingUser?.name || null,
    });
  } catch (error) {
    console.error("[T2W] Check email error:", error);
    return NextResponse.json({ error: "Failed to check email" }, { status: 500 });
  }
}
