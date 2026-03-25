import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import bcrypt from "bcryptjs";

/**
 * POST /api/rides/[id]/registrations/admin-manage
 * Admin adds a rider to a ride. Accepts riderName + optional riderProfileId/userId for precise lookup.
 * Auto-creates missing RiderProfile or User records so admin has full control.
 * Creates a confirmed RideRegistration (single source of truth), syncs RideParticipation and Ride.riders cache.
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
    const body = await req.json();
    const { riderName, riderProfileId, userId: providedUserId } = body;

    if (!riderName || typeof riderName !== "string") {
      return NextResponse.json({ error: "riderName is required" }, { status: 400 });
    }

    const trimmedName = riderName.trim();

    // --- Step 1: Find rider profile (by ID or name) ---
    let riderProfile = riderProfileId
      ? await prisma.riderProfile.findUnique({
          where: { id: riderProfileId },
          include: { linkedUsers: { select: { id: true, email: true, phone: true, name: true } } },
        })
      : await prisma.riderProfile.findFirst({
          where: {
            OR: [
              { name: { equals: trimmedName, mode: "insensitive" } },
              { email: { equals: trimmedName, mode: "insensitive" } },
            ],
            mergedIntoId: null,
          },
          include: { linkedUsers: { select: { id: true, email: true, phone: true, name: true } } },
        });

    // --- Step 2: Find user account (by ID, linked profile, or name/email) ---
    let linkedUser = providedUserId
      ? await prisma.user.findUnique({
          where: { id: providedUserId },
          select: { id: true, email: true, phone: true, name: true },
        })
      : null;

    if (!linkedUser && riderProfile?.linkedUsers?.length) {
      linkedUser = riderProfile.linkedUsers[0];
    }

    if (!linkedUser) {
      // Try finding user by name or email
      linkedUser = await prisma.user.findFirst({
        where: {
          OR: [
            { name: { equals: trimmedName, mode: "insensitive" } },
            { email: { equals: trimmedName, mode: "insensitive" } },
            ...(riderProfile?.email ? [{ email: { equals: riderProfile.email, mode: "insensitive" as const } }] : []),
          ],
        },
        select: { id: true, email: true, phone: true, name: true },
      });
    }

    // --- Step 3: Auto-create missing records so admin can always add riders ---

    // If we have a RiderProfile but no User → create a placeholder User account
    if (riderProfile && !linkedUser) {
      const email = riderProfile.email || `${riderProfile.id}@placeholder.t2w`;
      // Check if email is taken (edge case)
      const existingUserByEmail = await prisma.user.findUnique({ where: { email } });
      if (existingUserByEmail) {
        linkedUser = existingUserByEmail;
      } else {
        const placeholderPassword = await bcrypt.hash(`t2w_${Date.now()}_${Math.random()}`, 10);
        const newUser = await prisma.user.create({
          data: {
            name: riderProfile.name,
            email,
            phone: riderProfile.phone || "",
            password: placeholderPassword,
            role: riderProfile.role === "core_member" ? "admin" : "rider",
            isApproved: true,
            linkedRiderId: riderProfile.id,
          },
        });
        linkedUser = { id: newUser.id, email: newUser.email, phone: newUser.phone, name: newUser.name };
      }
    }

    // If we have a User but no RiderProfile → create a RiderProfile from User data
    if (linkedUser && !riderProfile) {
      riderProfile = await prisma.riderProfile.create({
        data: {
          name: linkedUser.name || trimmedName,
          email: linkedUser.email || "",
          phone: linkedUser.phone || "",
          role: "rider",
        },
        include: { linkedUsers: { select: { id: true, email: true, phone: true, name: true } } },
      });
      // Link them
      await prisma.user.update({
        where: { id: linkedUser.id },
        data: { linkedRiderId: riderProfile.id },
      });
    }

    // If neither found at all
    if (!linkedUser) {
      return NextResponse.json(
        { error: `No rider or user found for "${trimmedName}". Try searching by email or phone.` },
        { status: 400 }
      );
    }

    // --- Step 4: Auto-link if both exist but aren't connected ---
    if (riderProfile && linkedUser) {
      const userRecord = await prisma.user.findUnique({
        where: { id: linkedUser.id },
        select: { linkedRiderId: true },
      });
      if (!userRecord?.linkedRiderId) {
        await prisma.user.update({
          where: { id: linkedUser.id },
          data: { linkedRiderId: riderProfile.id },
        });
      }
    }

    // --- Step 5: Create or confirm the RideRegistration ---
    const existingReg = await prisma.rideRegistration.findUnique({
      where: { userId_rideId: { userId: linkedUser.id, rideId } },
    });

    if (existingReg) {
      if (existingReg.approvalStatus !== "confirmed") {
        await prisma.rideRegistration.update({
          where: { id: existingReg.id },
          data: { approvalStatus: "confirmed" },
        });
      }
    } else {
      const confirmationCode = `T2W-${rideId.slice(0, 8).toUpperCase()}-ADM${Date.now().toString(36).toUpperCase()}`;
      await prisma.rideRegistration.create({
        data: {
          userId: linkedUser.id,
          rideId,
          riderName: riderProfile?.name || trimmedName,
          email: linkedUser.email || "",
          phone: linkedUser.phone || "",
          approvalStatus: "confirmed",
          confirmationCode,
        },
      });
    }

    // --- Step 6: Sync RideParticipation for leaderboard ---
    if (riderProfile) {
      await prisma.rideParticipation.upsert({
        where: { riderProfileId_rideId: { riderProfileId: riderProfile.id, rideId } },
        update: { droppedOut: false },
        create: { riderProfileId: riderProfile.id, rideId, points: 5 },
      });
    }

    // --- Step 7: Sync Ride.riders cache ---
    await syncRideRidersFromRegistrations(rideId);

    return NextResponse.json({ success: true, riderName: riderProfile?.name || trimmedName });
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
