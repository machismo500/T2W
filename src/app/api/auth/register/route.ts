import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, createToken, setAuthCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const email = String(data.email || "").toLowerCase().trim();
    const name = String(data.name || "").trim();
    const password = String(data.password || "");
    const phone = String(data.phone || "").trim() || null;
    const city = String(data.city || "").trim() || null;
    const ridingExperience = String(data.ridingExperience || "").trim() || null;

    if (!email || !name || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 12) {
      return NextResponse.json(
        { error: "Password must be at least 12 characters" },
        { status: 400 }
      );
    }

    // Check if a user account already exists with this email
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists. Please log in instead.", existingAccount: true },
        { status: 409 }
      );
    }

    const hashedPassword = await hashPassword(password);

    // Check if a rider profile exists with this email (from admin-imported data)
    const existingProfile = await prisma.riderProfile.findFirst({
      where: { email, mergedIntoId: null },
      include: {
        participations: {
          include: { ride: { select: { distanceKm: true } } },
        },
      },
    });

    // Calculate stats from rider profile if it exists
    const totalKm = existingProfile
      ? existingProfile.participations.reduce((sum: number, p: typeof existingProfile.participations[number]) => sum + p.ride.distanceKm, 0)
      : 0;
    const ridesCompleted = existingProfile
      ? existingProfile.participations.length
      : 0;

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        phone,
        city,
        ridingExperience,
        role: "rider",
        isApproved: false,
        linkedRiderId: existingProfile?.id || null,
        totalKm,
        ridesCompleted,
      },
      include: {
        motorcycles: true,
        earnedBadges: { include: { badge: true } },
      },
    });

    // If no rider profile exists, create one for this new user
    if (!existingProfile) {
      const newProfile = await prisma.riderProfile.create({
        data: {
          name,
          email,
          phone: phone || "",
        },
      });
      await prisma.user.update({
        where: { id: user.id },
        data: { linkedRiderId: newProfile.id },
      });
    }

    // Create motorcycle if provided
    const motorcycleStr = String(data.motorcycle || "").trim();
    if (motorcycleStr) {
      await prisma.motorcycle.create({
        data: {
          make: motorcycleStr,
          model: "",
          year: new Date().getFullYear(),
          cc: 0,
          color: "",
          userId: user.id,
        },
      });
    }

    const token = await createToken(user.id);
    await setAuthCookie(token);

    // Re-fetch with relations after all updates
    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        motorcycles: true,
        earnedBadges: { include: { badge: true } },
      },
    });

    const { password: _, ...userWithoutPassword } = fullUser!;
    return NextResponse.json({ user: userWithoutPassword });
  } catch (error) {
    console.error("[T2W] Register error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
