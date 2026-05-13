import { NextRequest, after } from "next/server";
import { prisma } from "@/lib/db";
import { apiError, apiOk } from "@/lib/api/v1/errors";
import { requireBearer, isAdminRole } from "@/lib/api/v1/auth-guard";
import { recordActivity } from "@/lib/api/v1/audit";
import { notifyUser } from "@/lib/push/dispatch";

type PatchBody = {
  approvalStatus?: "confirmed" | "rejected" | "dropout";
  accommodationType?: "bed";
};

/**
 * PATCH /api/v1/admin/registrations/:regId
 *
 * Mirrors the web's per-registration approval flow but lives outside the
 * /rides/:id/registrations/:regId tree so the mobile admin queue can patch
 * by reg id without needing to thread the ride id through every screen.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ regId: string }> },
) {
  const auth = await requireBearer(req);
  if (!auth.ok) return apiError("UNAUTHORIZED", "Authentication required");
  if (!isAdminRole(auth.user.role)) return apiError("FORBIDDEN", "Admin only");

  const { regId } = await params;
  const data = (await req.json()) as PatchBody;

  if (data.approvalStatus && !["confirmed", "rejected", "dropout"].includes(data.approvalStatus)) {
    return apiError("BAD_REQUEST", "Invalid status");
  }
  if (data.accommodationType && data.accommodationType !== "bed") {
    return apiError("BAD_REQUEST", "Only 'bed' upgrade supported");
  }
  if (!data.approvalStatus && !data.accommodationType) {
    return apiError("BAD_REQUEST", "Provide approvalStatus or accommodationType");
  }

  const registration = await prisma.rideRegistration.findUnique({ where: { id: regId } });
  if (!registration) return apiError("NOT_FOUND", "Registration not found");

  const regUser = registration.userId
    ? await prisma.user.findUnique({
        where: { id: registration.userId },
        select: { linkedRiderId: true },
      })
    : null;

  // Capacity guard before approving (TOCTOU-safe like the web).
  if (data.approvalStatus === "confirmed") {
    const ride = await prisma.ride.findUnique({
      where: { id: registration.rideId },
      select: { maxRiders: true, extraBedSlots: true },
    });
    if (ride) {
      const cap = ride.maxRiders + (ride.extraBedSlots ?? 0);
      const activeCount = await prisma.rideRegistration.count({
        where: {
          rideId: registration.rideId,
          approvalStatus: { in: ["pending", "confirmed"] },
          id: { not: regId },
        },
      });
      if (activeCount >= cap) {
        return apiError("RIDE_FULL", "This ride is full — no spots available");
      }
    }
  }

  const updateData: Record<string, unknown> = {};
  if (data.approvalStatus) updateData.approvalStatus = data.approvalStatus;
  if (data.accommodationType) updateData.accommodationType = data.accommodationType;

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.rideRegistration.update({ where: { id: regId }, data: updateData });
    if (data.approvalStatus === "confirmed" && regUser?.linkedRiderId) {
      await tx.rideParticipation.upsert({
        where: {
          riderProfileId_rideId: {
            riderProfileId: regUser.linkedRiderId,
            rideId: registration.rideId,
          },
        },
        update: { droppedOut: false },
        create: {
          riderProfileId: regUser.linkedRiderId,
          rideId: registration.rideId,
          points: 5,
        },
      });
    }
    if (data.approvalStatus === "dropout" && regUser?.linkedRiderId) {
      await tx.rideParticipation.updateMany({
        where: {
          riderProfileId: regUser.linkedRiderId,
          rideId: registration.rideId,
        },
        data: { droppedOut: true },
      });
    }
    // Keep the cached riders array on Ride in sync the same way the web does.
    const confirmed = await tx.rideRegistration.findMany({
      where: { rideId: registration.rideId, approvalStatus: "confirmed" },
      select: { riderName: true },
      orderBy: { registeredAt: "asc" },
    });
    await tx.ride.update({
      where: { id: registration.rideId },
      data: { riders: JSON.stringify(confirmed.map((r) => r.riderName)) },
    });
    return u;
  });

  if (
    data.approvalStatus &&
    registration.userId &&
    registration.approvalStatus !== data.approvalStatus
  ) {
    const ride = await prisma.ride.findUnique({
      where: { id: registration.rideId },
      select: { title: true },
    });
    const rideTitle = ride?.title ?? "your ride";
    let title = "";
    let message = "";
    let type: "info" | "success" | "warning" | "ride" = "ride";
    if (data.approvalStatus === "confirmed") {
      title = "Registration confirmed";
      message = `Your spot for "${rideTitle}" is confirmed. See you on the road.`;
      type = "success";
    } else if (data.approvalStatus === "rejected") {
      title = "Registration rejected";
      message = `Your registration for "${rideTitle}" wasn't approved. Tap for details.`;
      type = "warning";
    } else if (data.approvalStatus === "dropout") {
      title = "Marked as dropped out";
      message = `You've been marked as a drop-out for "${rideTitle}". Reach out to the crew if this is wrong.`;
      type = "warning";
    }
    if (title) {
      const userId = registration.userId;
      const rideId = registration.rideId;
      after(() =>
        notifyUser({
          userId,
          type,
          title,
          message,
          data: { kind: "ride", rideId },
        }).catch((err) => console.warn("[T2W][v1] registration push failed:", err)),
      );
    }
  }

  if (data.approvalStatus && registration.approvalStatus !== data.approvalStatus) {
    const targetApprovalStatus = data.approvalStatus;
    const previousStatus = registration.approvalStatus;
    const targetRiderName = registration.riderName;
    after(() =>
      recordActivity({
        action: `registration_${targetApprovalStatus}`,
        performedBy: { id: auth.user.id, name: auth.user.name },
        target: { id: registration.id, name: targetRiderName },
        details: `Changed ${targetRiderName}'s registration from ${previousStatus} to ${targetApprovalStatus}`,
      }).catch(() => {}),
    );
  }

  return apiOk({
    registration: {
      id: updated.id,
      approvalStatus: updated.approvalStatus,
      accommodationType: updated.accommodationType,
    },
  });
}
