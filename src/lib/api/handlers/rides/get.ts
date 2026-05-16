import { z } from "zod";
import { prisma } from "@/lib/db";
import { computeRideStatus } from "@/lib/ride-status";
import { safeJsonParse } from "@/lib/json-utils";
import { ApiError } from "../../errors";
import { RideDetailResponseSchema, RideIdParamSchema } from "../../schemas/rides";
import { registerRoute } from "../../openapi/routes";
import { ErrorEnvelopeSchema } from "../../schemas/common";
import type { Ctx } from "../../middleware";

registerRoute({
  method: "get",
  path: "/api/v1/rides/{id}",
  summary: "Get a single ride by id",
  tags: ["rides"],
  request: { params: RideIdParamSchema },
  responses: {
    200: { description: "Ride detail", schema: RideDetailResponseSchema },
    404: { description: "Ride not found", schema: ErrorEnvelopeSchema },
  },
});

export type GetRideResponse = z.infer<typeof RideDetailResponseSchema>;

export async function getRide(rideId: string, _ctx: Ctx): Promise<GetRideResponse> {
  const r = await prisma.ride.findUnique({
    where: { id: rideId },
    include: {
      registrations: { select: { id: true, approvalStatus: true } },
    },
  });
  if (!r) throw new ApiError("NOT_FOUND", "Ride not found");

  const confirmed = r.registrations.filter((reg) => reg.approvalStatus === "confirmed").length;

  return {
    ride: {
      id: r.id,
      title: r.title,
      rideNumber: r.rideNumber,
      type: r.type as GetRideResponse["ride"]["type"],
      status: computeRideStatus(r.startDate, r.endDate, r.status) as GetRideResponse["ride"]["status"],
      startDate: r.startDate.toISOString(),
      endDate: r.endDate.toISOString(),
      startLocation: r.startLocation,
      startLocationUrl: r.startLocationUrl,
      endLocation: r.endLocation,
      endLocationUrl: r.endLocationUrl,
      distanceKm: r.distanceKm,
      maxRiders: r.maxRiders,
      difficulty: r.difficulty as GetRideResponse["ride"]["difficulty"],
      fee: r.fee,
      posterUrl: r.posterUrl,
      leadRider: r.leadRider,
      sweepRider: r.sweepRider,
      detailsVisible: r.detailsVisible,
      description: r.description,
      highlights: safeJsonParse(r.highlights, []) as string[],
      route: safeJsonParse(r.route, []) as string[],
      extraBedSlots: r.extraBedSlots,
      extraBedFee: r.extraBedFee,
      organisedBy: r.organisedBy,
      accountsBy: r.accountsBy,
      meetupTime: r.meetupTime,
      rideStartTime: r.rideStartTime,
      startingPoint: r.startingPoint,
      riders: (safeJsonParse(r.riders, []) as string[]) ?? [],
      registrationCount: confirmed,
    },
  };
}
