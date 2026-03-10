import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword, createToken, setAuthCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        motorcycles: true,
        earnedBadges: { include: { badge: true } },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // On login, ensure user is linked to their rider profile (if one exists)
    let linkedRiderId = user.linkedRiderId;
    if (!linkedRiderId) {
      const matchingProfile = await prisma.riderProfile.findFirst({
        where: { email: normalizedEmail, mergedIntoId: null },
      });
      if (matchingProfile) {
        linkedRiderId = matchingProfile.id;
        await prisma.user.update({
          where: { id: user.id },
          data: { linkedRiderId: matchingProfile.id },
        });
      }
    }

    // Sync stats from rider profile participation data
    if (linkedRiderId) {
      const participations = await prisma.rideParticipation.findMany({
        where: { riderProfileId: linkedRiderId },
        include: { ride: { select: { distanceKm: true } } },
      });
      const totalKm = participations.reduce((sum: number, p: typeof participations[number]) => sum + p.ride.distanceKm, 0);
      const ridesCompleted = participations.length;

      if (user.totalKm !== totalKm || user.ridesCompleted !== ridesCompleted) {
        await prisma.user.update({
          where: { id: user.id },
          data: { totalKm, ridesCompleted },
        });
        user.totalKm = totalKm;
        user.ridesCompleted = ridesCompleted;
      }
    }

    const token = await createToken(user.id);
    await setAuthCookie(token);

    const { password: _, ...userWithoutPassword } = user;
    return NextResponse.json({
      user: { ...userWithoutPassword, linkedRiderId },
    });
  } catch (error) {
    console.error("[T2W] Login error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
