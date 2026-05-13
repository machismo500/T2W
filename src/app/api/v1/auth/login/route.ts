import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import { apiError, apiOk } from "@/lib/api/v1/errors";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  createAccessToken,
  issueRefreshToken,
} from "@/lib/api/v1/tokens";
import { awardBadgesForUser } from "@/app/api/badges/route";

type LoginBody = {
  email?: string;
  password?: string;
  deviceId?: string;
  platform?: "ios" | "android";
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as LoginBody;
    const email = body.email?.toLowerCase().trim();
    const password = body.password;

    if (!email || !password) {
      return apiError("BAD_REQUEST", "Email and password are required");
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        motorcycles: true,
        earnedBadges: { include: { badge: true } },
      },
    });

    if (!user || !(await verifyPassword(password, user.password))) {
      return apiError("INVALID_CREDENTIALS", "Invalid email or password");
    }

    // Mirror web login: resync linkedRiderId + stats + auto-upgrade role.
    let linkedRiderId = user.linkedRiderId;
    if (linkedRiderId) {
      const current = await prisma.riderProfile.findUnique({
        where: { id: linkedRiderId },
        select: { mergedIntoId: true },
      });
      if (current?.mergedIntoId) {
        linkedRiderId = current.mergedIntoId;
        await prisma.user.update({
          where: { id: user.id },
          data: { linkedRiderId: current.mergedIntoId },
        });
      }
    }

    if (!linkedRiderId) {
      const profiles = await prisma.riderProfile.findMany({
        where: { email, mergedIntoId: null },
        include: { _count: { select: { participations: true } } },
        orderBy: { createdAt: "asc" },
      });
      if (profiles.length > 0) {
        const best = profiles.sort(
          (a, b) =>
            b._count.participations - a._count.participations ||
            a.createdAt.getTime() - b.createdAt.getTime(),
        )[0];
        linkedRiderId = best.id;
        await prisma.user.update({
          where: { id: user.id },
          data: { linkedRiderId: best.id },
        });
      }
    }

    if (linkedRiderId) {
      const parts = await prisma.rideParticipation.findMany({
        where: { riderProfileId: linkedRiderId },
        include: { ride: { select: { distanceKm: true } } },
      });
      const totalKm = parts.reduce((s, p) => s + p.ride.distanceKm, 0);
      const ridesCompleted = parts.length;
      const needsUpdate = user.totalKm !== totalKm || user.ridesCompleted !== ridesCompleted;
      const needsRoleUpgrade = user.role === "rider" && ridesCompleted > 0;
      if (needsUpdate || needsRoleUpgrade) {
        const data: Record<string, unknown> = { totalKm, ridesCompleted };
        if (needsRoleUpgrade) data.role = "t2w_rider";
        await prisma.user.update({ where: { id: user.id }, data });
        if (needsRoleUpgrade) {
          await prisma.riderProfile.update({
            where: { id: linkedRiderId },
            data: { role: "t2w_rider" },
          });
        }
        user.totalKm = totalKm;
        user.ridesCompleted = ridesCompleted;
        if (needsRoleUpgrade) (user as Record<string, unknown>).role = "t2w_rider";
      }
    }

    try {
      await awardBadgesForUser(user.id, user.totalKm);
    } catch {
      // badge table may not exist yet
    }

    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: { motorcycles: true, earnedBadges: { include: { badge: true } } },
    });

    const accessToken = await createAccessToken(user.id);
    const refresh = await issueRefreshToken({
      userId: user.id,
      deviceId: body.deviceId ?? null,
      platform: body.platform ?? null,
    });

    const { password: _pw, ...safe } = fullUser!;
    return apiOk({
      accessToken,
      accessTokenExpiresIn: ACCESS_TOKEN_TTL_SECONDS,
      refreshToken: refresh.token,
      refreshTokenExpiresAt: refresh.expiresAt.toISOString(),
      user: { ...safe, linkedRiderId },
    });
  } catch (err) {
    console.error("[T2W][v1] login error:", err);
    return apiError("SERVER_ERROR", "Something went wrong");
  }
}
