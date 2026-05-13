import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { computeRideStatus } from "@/lib/ride-status";
import { safeJsonParse } from "@/lib/json-utils";
import { apiError, apiOk } from "@/lib/api/v1/errors";
import { requireBearer } from "@/lib/api/v1/auth-guard";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireBearer(req);
  if (!auth.ok) {
    return apiError("UNAUTHORIZED", "Authentication required");
  }

  const { id } = await params;
  const ride = await prisma.ride.findUnique({
    where: { id },
    include: {
      participations: {
        include: { riderProfile: { select: { id: true, name: true, avatarUrl: true } } },
      },
      registrations: {
        select: {
          id: true,
          userId: true,
          confirmationCode: true,
          approvalStatus: true,
          riderName: true,
          accommodationType: true,
        },
      },
    },
  });

  if (!ride) {
    return apiError("NOT_FOUND", "Ride not found");
  }

  const myReg = ride.registrations.find(
    (r) => r.userId === auth.user.id && r.approvalStatus !== "rejected",
  );
  const myDroppedOut = auth.user.linkedRiderId
    ? ride.participations.some(
        (p) => p.riderProfileId === auth.user.linkedRiderId && p.droppedOut,
      )
    : false;

  return apiOk({
    ride: {
      id: ride.id,
      title: ride.title,
      rideNumber: ride.rideNumber,
      type: ride.type,
      status: computeRideStatus(ride.startDate, ride.endDate, ride.status),
      startDate: ride.startDate.toISOString(),
      endDate: ride.endDate.toISOString(),
      startLocation: ride.startLocation,
      startLocationUrl: ride.startLocationUrl,
      endLocation: ride.endLocation,
      endLocationUrl: ride.endLocationUrl,
      route: safeJsonParse(ride.route, []),
      distanceKm: ride.distanceKm,
      maxRiders: ride.maxRiders,
      extraBedSlots: ride.extraBedSlots,
      difficulty: ride.difficulty,
      description: ride.description,
      highlights: safeJsonParse(ride.highlights, []),
      posterUrl: ride.posterUrl,
      fee: ride.fee,
      leadRider: ride.leadRider,
      sweepRider: ride.sweepRider,
      organisedBy: ride.organisedBy,
      accountsBy: ride.accountsBy,
      meetupTime: ride.meetupTime,
      rideStartTime: ride.rideStartTime,
      startingPoint: ride.startingPoint,
      regOpenCore: ride.regOpenCore?.toISOString() ?? null,
      regOpenT2w: ride.regOpenT2w?.toISOString() ?? null,
      regOpenRider: ride.regOpenRider?.toISOString() ?? null,
      registeredRiders: ride.registrations.filter((r) => r.approvalStatus === "confirmed").length,
      confirmedRiders: ride.registrations
        .filter((r) => r.approvalStatus === "confirmed")
        .map((r) => ({ name: r.riderName, accommodationType: r.accommodationType || "bed" })),
      participations: ride.participations.map((p) => ({
        riderProfileId: p.riderProfileId,
        name: p.riderProfile?.name ?? null,
        avatarUrl: p.riderProfile?.avatarUrl ?? null,
        droppedOut: p.droppedOut,
        points: p.points,
      })),
      myRegistration: myReg && !myDroppedOut
        ? {
            id: myReg.id,
            confirmationCode: myReg.confirmationCode,
            approvalStatus: myReg.approvalStatus,
            accommodationType: myReg.accommodationType,
          }
        : null,
      myDroppedOut,
    },
  });
}
