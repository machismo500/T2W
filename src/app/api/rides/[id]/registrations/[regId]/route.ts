import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// PATCH /api/rides/[id]/registrations/[regId] - approve or reject a registration
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; regId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (
      !user ||
      (user.role !== "superadmin" && user.role !== "core_member")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: rideId, regId } = await params;
    const body = await req.json();
    const { approvalStatus, accommodationType } = body;

    const isStatusUpdate = approvalStatus !== undefined;
    const isAccommodationUpdate = accommodationType !== undefined;

    if (!isStatusUpdate && !isAccommodationUpdate) {
      return NextResponse.json(
        { error: "Must provide approvalStatus or accommodationType." },
        { status: 400 }
      );
    }
    if (isStatusUpdate && !["confirmed", "rejected", "dropout"].includes(approvalStatus)) {
      return NextResponse.json(
        { error: "Invalid status. Must be 'confirmed', 'rejected', or 'dropout'." },
        { status: 400 }
      );
    }
    if (isAccommodationUpdate && accommodationType !== "bed") {
      return NextResponse.json(
        { error: "Invalid accommodationType. Only upgrade to 'bed' is supported." },
        { status: 400 }
      );
    }

    const registration = await prisma.rideRegistration.findFirst({
      where: { id: regId, rideId },
    });

    if (!registration) {
      return NextResponse.json(
        { error: "Registration not found" },
        { status: 404 }
      );
    }

    // --- Accommodation type upgrade (extra-bed → bed) ---
    if (isAccommodationUpdate) {
      if (registration.approvalStatus !== "confirmed") {
        return NextResponse.json(
          { error: "Only confirmed registrations can be upgraded." },
          { status: 400 }
        );
      }
      if (registration.accommodationType !== "extra-bed") {
        return NextResponse.json(
          { error: "Registration is not an extra-bed slot." },
          { status: 400 }
        );
      }
      // Re-check bed availability inside a transaction to prevent TOCTOU races
      let updated: Awaited<ReturnType<typeof prisma.rideRegistration.update>>;
      try {
        updated = await prisma.$transaction(async (tx) => {
          const ride = await tx.ride.findUnique({
            where: { id: rideId },
            select: { maxRiders: true },
          });
          const bedCount = await tx.rideRegistration.count({
            where: { rideId, approvalStatus: "confirmed", accommodationType: "bed" },
          });
          if (!ride || bedCount >= ride.maxRiders) {
            throw new Error("NO_BED_SLOTS");
          }
          return tx.rideRegistration.update({
            where: { id: regId },
            data: { accommodationType: "bed" },
          });
        });
      } catch (err) {
        if (err instanceof Error && err.message === "NO_BED_SLOTS") {
          return NextResponse.json(
            { error: "No regular bed slots available." },
            { status: 409 }
          );
        }
        throw err;
      }
      // No Ride.riders sync needed — the cached name list is unaffected by
      // accommodation-type changes on an already-confirmed registration.
      return NextResponse.json({
        registration: {
          id: updated.id,
          accommodationType: updated.accommodationType,
        },
      });
    }

    // --- Approval status update ---
    // Status update + participation upsert + Ride.riders sync all run in a
    // single transaction so two admins approving different registrations at
    // the same time can't race and drop one from the cached riders list.
    const regUser = await prisma.user.findUnique({
      where: { id: registration.userId },
      select: { linkedRiderId: true },
    });

    const updated = await prisma.$transaction(async (tx) => {
      const upd = await tx.rideRegistration.update({
        where: { id: regId },
        data: { approvalStatus },
      });

      if (approvalStatus === "confirmed" && regUser?.linkedRiderId) {
        await tx.rideParticipation.upsert({
          where: {
            riderProfileId_rideId: {
              riderProfileId: regUser.linkedRiderId,
              rideId,
            },
          },
          update: { droppedOut: false },
          create: {
            riderProfileId: regUser.linkedRiderId,
            rideId,
            points: 5,
          },
        });
      }

      if (approvalStatus === "dropout" && regUser?.linkedRiderId) {
        await tx.rideParticipation.updateMany({
          where: {
            riderProfileId: regUser.linkedRiderId,
            rideId,
          },
          data: { droppedOut: true },
        });
      }

      // Re-read confirmed riders inside the transaction so the cache reflects
      // the state *after* this update — free of races with concurrent writes.
      const confirmed = await tx.rideRegistration.findMany({
        where: { rideId, approvalStatus: "confirmed" },
        select: { riderName: true },
        orderBy: { registeredAt: "asc" },
      });
      await tx.ride.update({
        where: { id: rideId },
        data: { riders: JSON.stringify(confirmed.map((r) => r.riderName)) },
      });

      return upd;
    });

    return NextResponse.json({
      registration: {
        id: updated.id,
        approvalStatus: updated.approvalStatus,
      },
    });
  } catch (error) {
    console.error("[T2W] Registration approval error:", error);
    return NextResponse.json(
      { error: "Failed to update registration" },
      { status: 500 }
    );
  }
}

