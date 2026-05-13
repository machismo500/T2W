import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { apiError, apiOk } from "@/lib/api/v1/errors";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  createAccessToken,
  issueRefreshToken,
} from "@/lib/api/v1/tokens";

type RegisterBody = {
  email?: string;
  name?: string;
  password?: string;
  phone?: string;
  city?: string;
  ridingExperience?: string;
  motorcycle?: string;
  deviceId?: string;
  platform?: "ios" | "android";
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RegisterBody;
    const email = body.email?.toLowerCase().trim() ?? "";
    const name = body.name?.trim() ?? "";
    const password = body.password ?? "";
    const phone = body.phone?.trim() || null;
    const city = body.city?.trim() || null;
    const ridingExperience = body.ridingExperience?.trim() || null;

    if (!email || !name || !password) {
      return apiError("BAD_REQUEST", "Name, email, and password are required");
    }
    if (password.length < 12) {
      return apiError("BAD_REQUEST", "Password must be at least 12 characters");
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return apiError(
        "ALREADY_REGISTERED",
        "An account with this email already exists. Please log in instead.",
      );
    }

    const hashedPassword = await hashPassword(password);
    const existingProfile = await prisma.riderProfile.findFirst({
      where: { email, mergedIntoId: null },
      include: {
        participations: { include: { ride: { select: { distanceKm: true } } } },
      },
    });

    const totalKm = existingProfile
      ? existingProfile.participations.reduce((s, p) => s + p.ride.distanceKm, 0)
      : 0;
    const ridesCompleted = existingProfile?.participations.length ?? 0;

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
        linkedRiderId: existingProfile?.id ?? null,
        totalKm,
        ridesCompleted,
      },
    });

    if (!existingProfile) {
      const newProfile = await prisma.riderProfile.create({
        data: { name, email, phone: phone || "" },
      });
      await prisma.user.update({
        where: { id: user.id },
        data: { linkedRiderId: newProfile.id },
      });
    }

    if (body.motorcycle?.trim()) {
      await prisma.motorcycle.create({
        data: {
          make: body.motorcycle.trim(),
          model: "",
          year: new Date().getFullYear(),
          cc: 0,
          color: "",
          userId: user.id,
        },
      });
    }

    const accessToken = await createAccessToken(user.id);
    const refresh = await issueRefreshToken({
      userId: user.id,
      deviceId: body.deviceId ?? null,
      platform: body.platform ?? null,
    });

    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: { motorcycles: true, earnedBadges: { include: { badge: true } } },
    });
    const { password: _pw, ...safe } = fullUser!;

    return apiOk({
      accessToken,
      accessTokenExpiresIn: ACCESS_TOKEN_TTL_SECONDS,
      refreshToken: refresh.token,
      refreshTokenExpiresAt: refresh.expiresAt.toISOString(),
      user: safe,
    });
  } catch (err) {
    console.error("[T2W][v1] register error:", err);
    return apiError("SERVER_ERROR", "Something went wrong");
  }
}
