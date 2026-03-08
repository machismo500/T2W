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

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const hashedPassword = await hashPassword(password);

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
      },
      include: {
        motorcycles: true,
        earnedBadges: { include: { badge: true } },
      },
    });

    // Create motorcycle if provided
    const motorcycleStr = String(data.motorcycle || "").trim();
    if (motorcycleStr) {
      // Try to parse "Make Model Year CC" format, or just store as make
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

    // Re-fetch with relations after motorcycle creation
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
