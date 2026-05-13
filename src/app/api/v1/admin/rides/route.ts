import { NextRequest, after } from "next/server";
import { prisma } from "@/lib/db";
import { getRolePermissions } from "@/lib/role-permissions";
import { apiError, apiOk } from "@/lib/api/v1/errors";
import { requireBearer, isAdminRole } from "@/lib/api/v1/auth-guard";
import { recordActivity } from "@/lib/api/v1/audit";

type CreateBody = {
  title?: string;
  type?: string;
  startDate?: string;
  endDate?: string;
  startLocation?: string;
  startLocationUrl?: string;
  endLocation?: string;
  endLocationUrl?: string;
  route?: Array<{ lat: number; lng: number } | string>;
  distanceKm?: number;
  maxRiders?: number;
  extraBedSlots?: number;
  difficulty?: string;
  description?: string;
  highlights?: string[];
  posterUrl?: string;
  fee?: number;
  leadRider?: string;
  sweepRider?: string;
  organisedBy?: string;
  accountsBy?: string;
  meetupTime?: string;
  rideStartTime?: string;
  startingPoint?: string;
  regOpenCore?: string;
  regOpenT2w?: string;
  regOpenRider?: string;
};

/**
 * POST /api/v1/admin/rides
 *
 * Mobile-shaped ride creation. We intentionally skip the email
 * announcement fan-out from this path — the web flow handles staggered
 * tier announcements, and the mobile-driven version should be opt-in
 * later when a separate "notify riders" CTA is added.
 */
export async function POST(req: NextRequest) {
  const auth = await requireBearer(req);
  if (!auth.ok) return apiError("UNAUTHORIZED", "Authentication required");
  if (!isAdminRole(auth.user.role)) return apiError("FORBIDDEN", "Admin only");
  if (auth.user.role === "core_member") {
    const perms = await getRolePermissions();
    if (!perms.core_member.canCreateRide) {
      return apiError("FORBIDDEN", "Core members do not have permission to create rides");
    }
  }

  const data = (await req.json()) as CreateBody;
  if (!data.title?.trim() || !data.startDate || !data.endDate || !data.startLocation || !data.endLocation) {
    return apiError(
      "BAD_REQUEST",
      "title, startDate, endDate, startLocation and endLocation are required",
    );
  }

  const totalRides = await prisma.ride.count();
  const rideNumber = `#${String(totalRides + 1).padStart(3, "0")}`;

  const ride = await prisma.ride.create({
    data: {
      title: data.title.trim(),
      rideNumber,
      type: data.type || "day",
      status: "upcoming",
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      startLocation: data.startLocation,
      startLocationUrl: data.startLocationUrl ?? null,
      endLocation: data.endLocation,
      endLocationUrl: data.endLocationUrl ?? null,
      route: JSON.stringify(data.route ?? []),
      distanceKm: Number(data.distanceKm ?? 0),
      maxRiders: Number(data.maxRiders ?? 40),
      extraBedSlots: Number(data.extraBedSlots ?? 0),
      difficulty: data.difficulty || "moderate",
      description: data.description ?? "",
      highlights: JSON.stringify(data.highlights ?? []),
      posterUrl: data.posterUrl ?? null,
      fee: Number(data.fee ?? 0),
      leadRider: data.leadRider ?? "",
      sweepRider: data.sweepRider ?? "",
      organisedBy: data.organisedBy ?? null,
      accountsBy: data.accountsBy ?? null,
      meetupTime: data.meetupTime ?? null,
      rideStartTime: data.rideStartTime ?? null,
      startingPoint: data.startingPoint ?? null,
      regOpenCore: data.regOpenCore ? new Date(data.regOpenCore) : null,
      regOpenT2w: data.regOpenT2w ? new Date(data.regOpenT2w) : null,
      regOpenRider: data.regOpenRider ? new Date(data.regOpenRider) : null,
    },
  });

  after(() =>
    recordActivity({
      action: "ride_created",
      performedBy: { id: auth.user.id, name: auth.user.name },
      target: { id: ride.id, name: ride.title },
      details: `Created ride "${ride.title}" (${ride.rideNumber})`,
    }).catch(() => {}),
  );

  return apiOk({ ride: { id: ride.id, rideNumber: ride.rideNumber } }, { status: 201 });
}
