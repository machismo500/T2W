import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// POST /api/riders/merge - merge duplicate rider profiles (super admin only)
// Moves all participation data from source to target, marks source as merged
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "superadmin") {
      return NextResponse.json({ error: "Only super admins can merge profiles" }, { status: 403 });
    }

    const { sourceId, targetId } = await req.json();

    if (!sourceId || !targetId) {
      return NextResponse.json({ error: "sourceId and targetId are required" }, { status: 400 });
    }

    if (sourceId === targetId) {
      return NextResponse.json({ error: "Cannot merge a profile into itself" }, { status: 400 });
    }

    // Verify both profiles exist
    const [source, target] = await Promise.all([
      prisma.riderProfile.findUnique({
        where: { id: sourceId },
        include: { participations: true },
      }),
      prisma.riderProfile.findUnique({
        where: { id: targetId },
        include: { participations: true },
      }),
    ]);

    if (!source) {
      return NextResponse.json({ error: "Source profile not found" }, { status: 404 });
    }
    if (!target) {
      return NextResponse.json({ error: "Target profile not found" }, { status: 404 });
    }

    // Move participation records from source to target
    const targetRideIds = new Set(target.participations.map((p: { rideId: string }) => p.rideId));
    let movedCount = 0;

    for (const participation of source.participations) {
      if (targetRideIds.has(participation.rideId)) {
        // Target already has participation for this ride - keep target's, delete source's
        await prisma.rideParticipation.delete({ where: { id: participation.id } });
      } else {
        // Move participation to target
        await prisma.rideParticipation.update({
          where: { id: participation.id },
          data: { riderProfileId: targetId },
        });
        movedCount++;
      }
    }

    // Accumulate stats
    await prisma.riderProfile.update({
      where: { id: targetId },
      data: {
        ridesOrganized: target.ridesOrganized + source.ridesOrganized,
        sweepsDone: target.sweepsDone + source.sweepsDone,
        pilotsDone: target.pilotsDone + source.pilotsDone,
        // Use earliest join date
        joinDate: source.joinDate < target.joinDate ? source.joinDate : target.joinDate,
        // Fill in missing fields from source if target has empty values
        phone: target.phone || source.phone,
        address: target.address || source.address,
        emergencyContact: target.emergencyContact || source.emergencyContact,
        emergencyPhone: target.emergencyPhone || source.emergencyPhone,
        bloodGroup: target.bloodGroup || source.bloodGroup,
      },
    });

    // Mark source as merged
    await prisma.riderProfile.update({
      where: { id: sourceId },
      data: { mergedIntoId: targetId },
    });

    // Re-link any users pointing to the source profile
    await prisma.user.updateMany({
      where: { linkedRiderId: sourceId },
      data: { linkedRiderId: targetId },
    });

    // Sync stats for target
    const participations = await prisma.rideParticipation.findMany({
      where: { riderProfileId: targetId },
      include: { ride: { select: { distanceKm: true } } },
    });
    const totalKm = participations.reduce((sum: number, p: typeof participations[number]) => sum + p.ride.distanceKm, 0);
    const ridesCompleted = participations.length;

    // Update linked user stats
    await prisma.user.updateMany({
      where: { linkedRiderId: targetId },
      data: { totalKm, ridesCompleted },
    });

    return NextResponse.json({
      success: true,
      mergedFrom: source.name,
      mergedInto: target.name,
      participationsMoved: movedCount,
    });
  } catch (error) {
    console.error("[T2W] Merge profiles error:", error);
    return NextResponse.json({ error: "Failed to merge profiles" }, { status: 500 });
  }
}

// GET /api/riders/merge - find potential duplicate profiles
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Find profiles with duplicate emails (case-insensitive)
    const profiles = await prisma.riderProfile.findMany({
      where: { mergedIntoId: null },
      select: { id: true, name: true, email: true, phone: true },
      orderBy: { email: "asc" },
    });

    // Group by email to find duplicates
    const emailGroups = new Map<string, typeof profiles>();
    for (const p of profiles) {
      const email = p.email.toLowerCase().trim();
      if (!email) continue;
      const existing = emailGroups.get(email) || [];
      existing.push(p);
      emailGroups.set(email, existing);
    }

    // Also check by name similarity
    const nameGroups = new Map<string, typeof profiles>();
    for (const p of profiles) {
      const name = p.name.toLowerCase().trim();
      const existing = nameGroups.get(name) || [];
      existing.push(p);
      nameGroups.set(name, existing);
    }

    const duplicates: Array<{
      type: "email" | "name";
      key: string;
      profiles: typeof profiles;
    }> = [];

    for (const [email, group] of emailGroups) {
      if (group.length > 1) {
        duplicates.push({ type: "email", key: email, profiles: group });
      }
    }
    for (const [name, group] of nameGroups) {
      if (group.length > 1) {
        // Don't add if already covered by email duplicate
        const emailDupIds = new Set(duplicates.flatMap((d: { profiles: Array<{ id: string }> }) => d.profiles.map((p: { id: string }) => p.id)));
        const isNewDup = group.some((p: { id: string }) => !emailDupIds.has(p.id));
        if (isNewDup) {
          duplicates.push({ type: "name", key: name, profiles: group });
        }
      }
    }

    return NextResponse.json({ duplicates });
  } catch (error) {
    console.error("[T2W] Find duplicates error:", error);
    return NextResponse.json({ error: "Failed to find duplicates" }, { status: 500 });
  }
}
