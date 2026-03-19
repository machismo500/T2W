import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

function safeJsonParse(value: string | null | undefined, fallback: unknown): unknown {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

// GET /api/rides/[id] - get a single ride
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const ride = await prisma.ride.findUnique({
      where: { id },
      include: {
        participations: {
          include: {
            riderProfile: {
              select: { id: true, name: true, avatarUrl: true },
            },
          },
        },
        registrations: {
          select: { id: true, userId: true, confirmationCode: true, approvalStatus: true, riderName: true },
        },
      },
    });

    if (!ride) {
      return NextResponse.json({ error: "Ride not found" }, { status: 404 });
    }

    // Check if current user is registered
    let currentUserRegistered = false;
    let currentUserConfirmationCode: string | null = null;
    let currentUserApprovalStatus: string | null = null;
    try {
      const currentUser = await getCurrentUser();
      if (currentUser) {
        const userReg = ride.registrations.find((r) => r.userId === currentUser.id);
        if (userReg) {
          currentUserRegistered = true;
          currentUserConfirmationCode = userReg.confirmationCode || null;
          currentUserApprovalStatus = userReg.approvalStatus || "pending";
        }
      }
    } catch {
      // Auth check is best-effort for GET
    }

    const result = {
      id: ride.id,
      title: ride.title,
      rideNumber: ride.rideNumber,
      type: ride.type,
      status: ride.status,
      startDate: ride.startDate.toISOString(),
      endDate: ride.endDate.toISOString(),
      startLocation: ride.startLocation,
      startLocationUrl: ride.startLocationUrl,
      endLocation: ride.endLocation,
      endLocationUrl: ride.endLocationUrl,
      route: safeJsonParse(ride.route, []),
      distanceKm: ride.distanceKm,
      maxRiders: ride.maxRiders,
      registeredRiders: ride.registrations.filter((r) => r.approvalStatus === "confirmed").length,
      confirmedRiderNames: ride.registrations
        .filter((r) => r.approvalStatus === "confirmed")
        .map((r) => r.riderName),
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
      riders: safeJsonParse(ride.riders, []),
      regFormSettings: safeJsonParse(ride.regFormSettings, null),
      regOpenCore: ride.regOpenCore?.toISOString() || null,
      regOpenT2w: ride.regOpenT2w?.toISOString() || null,
      regOpenRider: ride.regOpenRider?.toISOString() || null,
      participations: ride.participations.map((p) => ({
        id: p.id,
        riderProfileId: p.riderProfile.id,
        riderName: p.riderProfile.name,
        riderAvatar: p.riderProfile.avatarUrl,
        droppedOut: false,
        points: p.points,
      })),
      currentUserRegistered,
      currentUserConfirmationCode,
      currentUserApprovalStatus,
    };

    return NextResponse.json({ ride: result });
  } catch (error) {
    console.error("[T2W] Get ride error:", error);
    return NextResponse.json({ error: "Failed to load ride" }, { status: 500 });
  }
}

// PUT /api/rides/[id] - update a ride (admin only)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "superadmin" && user.role !== "core_member")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const data = await req.json();

    const updateData: Record<string, unknown> = {};
    const allowedFields = [
      "title", "type", "status", "startLocation", "startLocationUrl", "endLocation", "endLocationUrl",
      "distanceKm", "maxRiders", "difficulty", "description",
      "posterUrl", "fee", "leadRider", "sweepRider",
      "organisedBy", "accountsBy", "meetupTime", "rideStartTime", "startingPoint",
    ];

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    }

    // Handle date fields
    if (data.startDate) updateData.startDate = new Date(data.startDate);
    if (data.endDate) updateData.endDate = new Date(data.endDate);

    // Handle registration schedule fields (nullable datetimes)
    if (data.regOpenCore !== undefined) updateData.regOpenCore = data.regOpenCore ? new Date(data.regOpenCore) : null;
    if (data.regOpenT2w !== undefined) updateData.regOpenT2w = data.regOpenT2w ? new Date(data.regOpenT2w) : null;
    if (data.regOpenRider !== undefined) updateData.regOpenRider = data.regOpenRider ? new Date(data.regOpenRider) : null;

    // Handle JSON array fields
    if (data.route) updateData.route = JSON.stringify(data.route);
    if (data.highlights) updateData.highlights = JSON.stringify(data.highlights);
    if (data.riders !== undefined) updateData.riders = data.riders ? JSON.stringify(data.riders) : null;

    // Per-ride form settings: only SuperAdmin can update after creation
    if (data.regFormSettings !== undefined) {
      if (user.role !== "superadmin") {
        return NextResponse.json({ error: "Only SuperAdmin can edit registration form settings after ride is published" }, { status: 403 });
      }
      updateData.regFormSettings = data.regFormSettings ? JSON.stringify(data.regFormSettings) : null;
    }

    const updated = await prisma.ride.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ ride: updated });
  } catch (error) {
    console.error("[T2W] Update ride error:", error);
    return NextResponse.json({ error: "Failed to update ride" }, { status: 500 });
  }
}

// DELETE /api/rides/[id] - delete a ride (super admin only)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    await prisma.ride.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[T2W] Delete ride error:", error);
    return NextResponse.json({ error: "Failed to delete ride" }, { status: 500 });
  }
}
