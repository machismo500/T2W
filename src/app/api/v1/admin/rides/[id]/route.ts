import { NextRequest, after } from "next/server";
import { prisma } from "@/lib/db";
import { apiError, apiOk } from "@/lib/api/v1/errors";
import { requireBearer, isAdminRole } from "@/lib/api/v1/auth-guard";
import { recordActivity } from "@/lib/api/v1/audit";

type PatchBody = Partial<{
  title: string;
  type: string;
  status: string;
  startDate: string;
  endDate: string;
  startLocation: string;
  startLocationUrl: string;
  endLocation: string;
  endLocationUrl: string;
  route: Array<{ lat: number; lng: number } | string>;
  distanceKm: number;
  maxRiders: number;
  extraBedSlots: number;
  difficulty: string;
  description: string;
  highlights: string[];
  posterUrl: string;
  fee: number;
  leadRider: string;
  sweepRider: string;
  organisedBy: string;
  accountsBy: string;
  meetupTime: string;
  rideStartTime: string;
  startingPoint: string;
  detailsVisible: boolean;
  regOpenCore: string | null;
  regOpenT2w: string | null;
  regOpenRider: string | null;
}>;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireBearer(req);
  if (!auth.ok) return apiError("UNAUTHORIZED", "Authentication required");
  if (!isAdminRole(auth.user.role)) return apiError("FORBIDDEN", "Admin only");

  const { id } = await params;
  const existing = await prisma.ride.findUnique({ where: { id } });
  if (!existing) return apiError("NOT_FOUND", "Ride not found");

  const data = (await req.json()) as PatchBody;
  const updateData: Record<string, unknown> = {};
  const scalar: (keyof PatchBody)[] = [
    "title",
    "type",
    "status",
    "startLocation",
    "startLocationUrl",
    "endLocation",
    "endLocationUrl",
    "distanceKm",
    "maxRiders",
    "extraBedSlots",
    "difficulty",
    "description",
    "posterUrl",
    "fee",
    "leadRider",
    "sweepRider",
    "organisedBy",
    "accountsBy",
    "meetupTime",
    "rideStartTime",
    "startingPoint",
    "detailsVisible",
  ];
  for (const field of scalar) {
    if (data[field] !== undefined) updateData[field] = data[field];
  }
  if (data.startDate) updateData.startDate = new Date(data.startDate);
  if (data.endDate) updateData.endDate = new Date(data.endDate);
  if (data.route) updateData.route = JSON.stringify(data.route);
  if (data.highlights) updateData.highlights = JSON.stringify(data.highlights);
  if (data.regOpenCore !== undefined) {
    updateData.regOpenCore = data.regOpenCore ? new Date(data.regOpenCore) : null;
  }
  if (data.regOpenT2w !== undefined) {
    updateData.regOpenT2w = data.regOpenT2w ? new Date(data.regOpenT2w) : null;
  }
  if (data.regOpenRider !== undefined) {
    updateData.regOpenRider = data.regOpenRider ? new Date(data.regOpenRider) : null;
  }

  // Snapshot a rollback payload from the *previous* state before update.
  const rollbackData = {
    title: existing.title,
    type: existing.type,
    status: existing.status,
    startDate: existing.startDate.toISOString(),
    endDate: existing.endDate.toISOString(),
    startLocation: existing.startLocation,
    endLocation: existing.endLocation,
    distanceKm: existing.distanceKm,
    maxRiders: existing.maxRiders,
    extraBedSlots: existing.extraBedSlots,
    difficulty: existing.difficulty,
    description: existing.description,
    posterUrl: existing.posterUrl,
    fee: existing.fee,
    leadRider: existing.leadRider,
    sweepRider: existing.sweepRider,
    route: existing.route,
    highlights: existing.highlights,
  };

  const updated = await prisma.ride.update({ where: { id }, data: updateData });

  after(() =>
    recordActivity({
      action: "ride_edited",
      performedBy: { id: auth.user.id, name: auth.user.name },
      target: { id: updated.id, name: updated.title },
      details: `Edited ride "${updated.title}"`,
      rollbackData,
    }).catch(() => {}),
  );

  return apiOk({ ride: { id: updated.id, rideNumber: updated.rideNumber } });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireBearer(req);
  if (!auth.ok) return apiError("UNAUTHORIZED", "Authentication required");
  if (auth.user.role !== "superadmin") {
    return apiError("FORBIDDEN", "Only super admins can delete rides");
  }

  const { id } = await params;
  const existing = await prisma.ride.findUnique({ where: { id } });
  if (!existing) return apiError("NOT_FOUND", "Ride not found");

  const rollbackData = {
    title: existing.title,
    rideNumber: existing.rideNumber,
    type: existing.type,
    status: existing.status,
    startDate: existing.startDate.toISOString(),
    endDate: existing.endDate.toISOString(),
    startLocation: existing.startLocation,
    endLocation: existing.endLocation,
    distanceKm: existing.distanceKm,
    maxRiders: existing.maxRiders,
    difficulty: existing.difficulty,
    description: existing.description,
    posterUrl: existing.posterUrl,
    fee: existing.fee,
    leadRider: existing.leadRider,
    sweepRider: existing.sweepRider,
    route: existing.route,
    highlights: existing.highlights,
  };

  await prisma.ride.delete({ where: { id } });

  after(() =>
    recordActivity({
      action: "ride_deleted",
      performedBy: { id: auth.user.id, name: auth.user.name },
      target: { id, name: existing.title },
      details: `Deleted ride "${existing.title}"`,
      rollbackData,
    }).catch(() => {}),
  );

  return apiOk({ success: true });
}
