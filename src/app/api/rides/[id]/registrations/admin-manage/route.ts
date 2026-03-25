import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

/**
 * POST /api/rides/[id]/registrations/admin-manage
 * Admin adds a rider by name → creates a confirmed RideRegistration (single source of truth).
 * Also creates RideParticipation for leaderboard sync and updates the Ride.riders cache.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "superadmin" && user.role !== "core_member")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: rideId } = await params;
    const { riderName } = await req.json();

    if (!riderName || typeof riderName !== "string") {
      return NextResponse.json({ error: "riderName is required" }, { status: 400 });
    }

    const trimmedName = riderName.trim();

    // Look up rider profile by name
    const riderProfile = await prisma.riderProfile.findFirst({
      where: {
        name: { equals: trimmedName, mode: "insensitive" },
        mergedIntoId: null,
      },
      include: { linkedUsers: { select: { id: true, email: true, phone: true } } },
    });

    // Find the linked user account (needed for RideRegistration)
    // First try linkedUsers from the rider profile, then fall back to direct User lookup by name
    let linkedUser = riderProfile?.linkedUsers?.[0];
    if (!linkedUser) {
      const userByName = await prisma.user.findFirst({
        where: { name: { equals: trimmedName, mode: "insensitive" } },
        select: { id: true, email: true, phone: true },
      });
      if (userByName) {
        linkedUser = userByName;
        // Auto-link the user to the rider profile if both exist
        if (riderProfile) {
          await prisma.user.update({
            where: { id: userByName.id },
            data: { linkedRiderId: riderProfile.id },
          });
        }
      }
    }
    if (!linkedUser) {
      return NextResponse.json(
        { error: `No user account found for "${trimmedName}". The rider must have a linked account to be added.` },
        { status: 400 }
      );
    }

    // Check if already registered
    const existingReg = await prisma.rideRegistration.findUnique({
      where: { userId_rideId: { userId: linkedUser.id, rideId } },
    });

    if (existingReg) {
      // If exists but not confirmed, confirm it
      if (existingReg.approvalStatus !== "confirmed") {
        await prisma.rideRegistration.update({
          where: { id: existingReg.id },
          data: { approvalStatus: "confirmed" },
        });
      }
    } else {
      // Create a confirmed registration
      const confirmationCode = `T2W-${rideId.slice(0, 8).toUpperCase()}-ADM${Date.now().toString(36).toUpperCase()}`;
      await prisma.rideRegistration.create({
        data: {
          userId: linkedUser.id,
          rideId,
          riderName: trimmedName,
          email: linkedUser.email,
          phone: linkedUser.phone || "",
          approvalStatus: "confirmed",
          confirmationCode,
        },
      });
    }

    // Also create RideParticipation for leaderboard sync
    if (riderProfile) {
      await prisma.rideParticipation.upsert({
        where: { riderProfileId_rideId: { riderProfileId: riderProfile.id, rideId } },
        update: { droppedOut: false },
        create: { riderProfileId: riderProfile.id, rideId, points: 5 },
      });
    }

    // Sync the Ride.riders cache from confirmed registrations
    await syncRideRidersFromRegistrations(rideId);

    return NextResponse.json({ success: true, riderName: trimmedName });
  } catch (error) {
    console.error("[T2W] Admin add rider error:", error);
    return NextResponse.json({ error: "Failed to add rider" }, { status: 500 });
  }
}

/**
 * DELETE /api/rides/[id]/registrations/admin-manage
 * Admin removes a rider by name → deletes their RideRegistration.
 * Also removes RideParticipation and updates the Ride.riders cache.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "superadmin" && user.role !== "core_member")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: rideId } = await params;
    const { riderName } = await req.json();

    if (!riderName || typeof riderName !== "string") {
      return NextResponse.json({ error: "riderName is required" }, { status: 400 });
    }

    const trimmedName = riderName.trim();

    // Find and delete the registration by rider name
    const registration = await prisma.rideRegistration.findFirst({
      where: { rideId, riderName: { equals: trimmedName, mode: "insensitive" } },
    });

    if (registration) {
      await prisma.rideRegistration.delete({ where: { id: registration.id } });
    }

    // Also remove RideParticipation
    const riderProfile = await prisma.riderProfile.findFirst({
      where: {
        name: { equals: trimmedName, mode: "insensitive" },
        mergedIntoId: null,
      },
    });

    if (riderProfile) {
      await prisma.rideParticipation.deleteMany({
        where: { riderProfileId: riderProfile.id, rideId },
      });
    }

    // Sync the Ride.riders cache from confirmed registrations
    await syncRideRidersFromRegistrations(rideId);

    return NextResponse.json({ success: true, riderName: trimmedName });
  } catch (error) {
    console.error("[T2W] Admin remove rider error:", error);
    return NextResponse.json({ error: "Failed to remove rider" }, { status: 500 });
  }
}

/**
 * Sync the Ride.riders JSON field from confirmed RideRegistration records.
 * This is the SINGLE SOURCE OF TRUTH — no longer syncing from RideParticipation.
 */
async function syncRideRidersFromRegistrations(rideId: string) {
  try {
    const confirmedRegistrations = await prisma.rideRegistration.findMany({
      where: { rideId, approvalStatus: "confirmed" },
      select: { riderName: true },
      orderBy: { registeredAt: "asc" },
    });

    const riderNames = confirmedRegistrations.map((r) => r.riderName);

    await prisma.ride.update({
      where: { id: rideId },
      data: { riders: JSON.stringify(riderNames) },
    });
  } catch (error) {
    console.error("[T2W] syncRideRidersFromRegistrations error:", error);
  }
}
