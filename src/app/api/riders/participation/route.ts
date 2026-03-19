import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// PUT /api/riders/participation - set participation for a rider in a ride
export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "superadmin" && user.role !== "core_member")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { riderProfileId, rideId, points } = await req.json();

    if (!riderProfileId || !rideId) {
      return NextResponse.json({ error: "riderProfileId and rideId are required" }, { status: 400 });
    }

    if (points <= 0) {
      // Remove participation
      await prisma.rideParticipation.deleteMany({
        where: { riderProfileId, rideId },
      });
      // Update user stats if linked
      await syncUserStats(riderProfileId);
      return NextResponse.json({ success: true, action: "removed" });
    }

    // Upsert participation
    await prisma.rideParticipation.upsert({
      where: { riderProfileId_rideId: { riderProfileId, rideId } },
      update: { points },
      create: { riderProfileId, rideId, points },
    });

    // Update user stats if linked
    await syncUserStats(riderProfileId);

    return NextResponse.json({ success: true, action: "set", points });
  } catch (error) {
    console.error("[T2W] Set participation error:", error);
    return NextResponse.json({ error: "Failed to set participation" }, { status: 500 });
  }
}

// POST /api/riders/participation - bulk set participation (for matrix save)
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "superadmin" && user.role !== "core_member")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { changes } = await req.json();
    // changes: Array<{ riderProfileId: string, rideId: string, points: number }>

    if (!Array.isArray(changes)) {
      return NextResponse.json({ error: "changes must be an array" }, { status: 400 });
    }

    const affectedRiderIds = new Set<string>();

    for (const change of changes) {
      const { riderProfileId, rideId, points } = change;
      affectedRiderIds.add(riderProfileId);

      if (points <= 0) {
        await prisma.rideParticipation.deleteMany({
          where: { riderProfileId, rideId },
        });
      } else {
        await prisma.rideParticipation.upsert({
          where: { riderProfileId_rideId: { riderProfileId, rideId } },
          update: { points },
          create: { riderProfileId, rideId, points },
        });
      }
    }

    // Sync stats for all affected riders
    for (const riderId of affectedRiderIds) {
      await syncUserStats(riderId);
    }

    return NextResponse.json({ success: true, processed: changes.length });
  } catch (error) {
    console.error("[T2W] Bulk participation error:", error);
    return NextResponse.json({ error: "Failed to save participation" }, { status: 500 });
  }
}

// PATCH /api/riders/participation - mark a rider as dropped out (superadmin only)
export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { riderProfileId, rideId, droppedOut } = await req.json();

    if (!riderProfileId || !rideId) {
      return NextResponse.json({ error: "riderProfileId and rideId are required" }, { status: 400 });
    }

    await prisma.rideParticipation.update({
      where: { riderProfileId_rideId: { riderProfileId, rideId } },
      data: { droppedOut: Boolean(droppedOut) },
    });

    // Re-sync user stats (excluding dropped-out rides)
    await syncUserStats(riderProfileId);

    return NextResponse.json({ success: true, droppedOut: Boolean(droppedOut) });
  } catch (error) {
    console.error("[T2W] Drop-out error:", error);
    return NextResponse.json({ error: "Failed to update drop-out status" }, { status: 500 });
  }
}

async function syncUserStats(riderProfileId: string) {
  const linkedUsers = await prisma.user.findMany({
    where: { linkedRiderId: riderProfileId },
    select: { id: true, role: true },
  });

  if (linkedUsers.length === 0) return;

  const participations = await prisma.rideParticipation.findMany({
    where: { riderProfileId, droppedOut: false },
    include: { ride: { select: { distanceKm: true } } },
  });

  const totalKm = participations.reduce((sum: number, p: typeof participations[number]) => sum + p.ride.distanceKm, 0);
  const ridesCompleted = participations.length;

  for (const u of linkedUsers) {
    const updateData: Record<string, unknown> = { totalKm, ridesCompleted };
    // Auto-upgrade: "rider" → "t2w_rider" when they have at least 1 ride participation
    if (u.role === "rider" && ridesCompleted > 0) {
      updateData.role = "t2w_rider";
    }
    await prisma.user.update({
      where: { id: u.id },
      data: updateData,
    });
  }
}
