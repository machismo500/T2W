import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/riders/[id] - get a single rider profile
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const profile = await prisma.riderProfile.findUnique({
      where: { id },
      include: {
        participations: {
          include: {
            ride: {
              select: { id: true, rideNumber: true, title: true, startDate: true, distanceKm: true },
            },
          },
        },
        linkedUsers: {
          select: { role: true },
          take: 1,
        },
      },
    });

    if (!profile) {
      return NextResponse.json({ error: "Rider not found" }, { status: 404 });
    }

    // If merged, redirect to the target profile
    if (profile.mergedIntoId) {
      return NextResponse.json({
        error: "This profile has been merged",
        mergedIntoId: profile.mergedIntoId,
      }, { status: 301 });
    }

    // Exclude dropped-out rides from active stats
    const activeParticipations = profile.participations.filter(
      (p: typeof profile.participations[number]) => !p.droppedOut
    );

    const isPrivileged = user.role === "superadmin" || user.role === "core_member";

    const rider = {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      phone: profile.phone,
      address: profile.address,
      emergencyContact: isPrivileged ? profile.emergencyContact : undefined,
      emergencyPhone: isPrivileged ? profile.emergencyPhone : undefined,
      bloodGroup: profile.bloodGroup,
      joinDate: profile.joinDate.toISOString(),
      avatarUrl: profile.avatarUrl,
      ridesOrganized: profile.ridesOrganized,
      sweepsDone: profile.sweepsDone,
      pilotsDone: profile.pilotsDone,
      userRole: profile.role !== "rider" ? profile.role : (profile.linkedUsers[0]?.role || null),
      ridesCompleted: activeParticipations.length,
      totalKm: activeParticipations.reduce((sum: number, p: typeof profile.participations[number]) => sum + p.ride.distanceKm, 0),
      totalPoints: activeParticipations.reduce((sum: number, p: typeof profile.participations[number]) => sum + p.points, 0),
      ridesParticipated: activeParticipations.map((p: typeof profile.participations[number]) => ({
        rideId: p.ride.id,
        rideNumber: p.ride.rideNumber,
        rideTitle: p.ride.title,
        rideDate: p.ride.startDate.toISOString(),
        distanceKm: p.ride.distanceKm,
        points: p.points,
        droppedOut: p.droppedOut,
      })),
    };

    return NextResponse.json({ rider });
  } catch (error) {
    console.error("[T2W] Get rider error:", error);
    return NextResponse.json({ error: "Failed to load rider" }, { status: 500 });
  }
}

// PUT /api/riders/[id] - update a rider profile
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Check permissions: super admin can edit any, users can edit their own linked profile
    const isSuperAdmin = user.role === "superadmin";
    const isOwnProfile = user.linkedRiderId === id;

    if (!isSuperAdmin && !isOwnProfile) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const data = await req.json();
    const userFields = ["name", "email", "phone", "address", "emergencyContact", "emergencyPhone", "bloodGroup", "avatarUrl"];
    const adminOnlyFields = ["ridesOrganized", "sweepsDone", "pilotsDone"];
    const allowedFields = isSuperAdmin ? [...userFields, ...adminOnlyFields] : userFields;
    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    }

    const updated = await prisma.riderProfile.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ profile: updated });
  } catch (error) {
    console.error("[T2W] Update rider error:", error);
    return NextResponse.json({ error: "Failed to update rider" }, { status: 500 });
  }
}

// DELETE /api/riders/[id] - delete a rider profile (super admin only)
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

    // Unlink any users first
    await prisma.user.updateMany({
      where: { linkedRiderId: id },
      data: { linkedRiderId: null },
    });

    await prisma.riderProfile.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[T2W] Delete rider error:", error);
    return NextResponse.json({ error: "Failed to delete rider" }, { status: 500 });
  }
}
