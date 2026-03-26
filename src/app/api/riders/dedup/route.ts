import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// POST /api/riders/dedup - auto-deduplicate rider profiles by email
// For each email with multiple profiles, keeps the one with more participation
// data (or the earliest one) and merges the rest into it.
export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "superadmin") {
      return NextResponse.json({ error: "Only super admins can deduplicate" }, { status: 403 });
    }

    // Find all unmerged profiles grouped by email
    const profiles = await prisma.riderProfile.findMany({
      where: { mergedIntoId: null, email: { not: "" } },
      include: {
        participations: { select: { id: true, rideId: true, points: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    const emailGroups = new Map<string, typeof profiles>();
    for (const p of profiles) {
      const email = p.email.toLowerCase().trim();
      if (!email) continue;
      const group = emailGroups.get(email) || [];
      group.push(p);
      emailGroups.set(email, group);
    }

    let mergedCount = 0;
    const mergeResults: Array<{ email: string; kept: string; merged: string[] }> = [];

    for (const [email, group] of emailGroups) {
      if (group.length <= 1) continue;

      // Pick the "best" profile to keep: the one with more participations,
      // or earliest created, or the one with more data fields filled
      group.sort((a, b) => {
        // More participations wins
        if (a.participations.length !== b.participations.length) {
          return b.participations.length - a.participations.length;
        }
        // Earlier creation date wins
        return a.createdAt.getTime() - b.createdAt.getTime();
      });

      const target = group[0];
      const sources = group.slice(1);

      // Load target's existing ride IDs once before iterating sources
      const targetRideIds = new Set(
        (await prisma.rideParticipation.findMany({
          where: { riderProfileId: target.id },
          select: { rideId: true },
        })).map((p) => p.rideId)
      );

      for (const source of sources) {
        // Move participation records from source to target

        for (const participation of source.participations) {
          if (targetRideIds.has(participation.rideId)) {
            await prisma.rideParticipation.delete({ where: { id: participation.id } });
          } else {
            await prisma.rideParticipation.update({
              where: { id: participation.id },
              data: { riderProfileId: target.id },
            });
          }
        }

        // Accumulate stats and fill missing fields
        await prisma.riderProfile.update({
          where: { id: target.id },
          data: {
            ridesOrganized: target.ridesOrganized + source.ridesOrganized,
            sweepsDone: target.sweepsDone + source.sweepsDone,
            pilotsDone: target.pilotsDone + source.pilotsDone,
            joinDate: source.joinDate < target.joinDate ? source.joinDate : target.joinDate,
            phone: target.phone || source.phone,
            address: target.address || source.address,
            emergencyContact: target.emergencyContact || source.emergencyContact,
            emergencyPhone: target.emergencyPhone || source.emergencyPhone,
            bloodGroup: target.bloodGroup || source.bloodGroup,
            avatarUrl: target.avatarUrl || source.avatarUrl,
          },
        });

        // Mark source as merged
        await prisma.riderProfile.update({
          where: { id: source.id },
          data: { mergedIntoId: target.id },
        });

        // Re-link any users pointing to the source
        await prisma.user.updateMany({
          where: { linkedRiderId: source.id },
          data: { linkedRiderId: target.id },
        });

        mergedCount++;
      }

      // Sync stats for the target profile's linked users
      const participations = await prisma.rideParticipation.findMany({
        where: { riderProfileId: target.id },
        include: { ride: { select: { distanceKm: true } } },
      });
      const totalKm = participations.reduce((sum, p) => sum + p.ride.distanceKm, 0);
      const ridesCompleted = participations.length;

      await prisma.user.updateMany({
        where: { linkedRiderId: target.id },
        data: { totalKm, ridesCompleted },
      });

      mergeResults.push({
        email,
        kept: `${target.name} (${target.id})`,
        merged: sources.map((s) => `${s.name} (${s.id})`),
      });
    }

    return NextResponse.json({
      success: true,
      mergedCount,
      details: mergeResults,
    });
  } catch (error) {
    console.error("[T2W] Dedup error:", error);
    return NextResponse.json({ error: "Failed to deduplicate" }, { status: 500 });
  }
}
