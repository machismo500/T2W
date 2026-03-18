import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

function safeJsonParse<T>(val: string | null | undefined, fallback: T): T {
  if (!val) return fallback;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

// POST /api/riders/sync-roles - comprehensive role sync based on ALL ride participation data
// 1. Cross-references Ride.riders JSON with RideParticipation records
// 2. Creates missing RideParticipation records for riders found in Ride.riders but not in DB
// 3. Upgrades users with ≥1 participation to "t2w_rider"
// 4. Downgrades users with 0 participations to "rider"
// 5. Keeps User.role and RiderProfile.role in sync
export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 1. Clear ALL droppedOut flags (no dropouts in past rides)
    const clearedDropouts = await prisma.rideParticipation.updateMany({
      where: { droppedOut: true },
      data: { droppedOut: false },
    });

    // 2. Cross-reference Ride.riders JSON with RideParticipation records
    // Find riders listed in past rides who don't have participation records
    const allRides = await prisma.ride.findMany({
      where: { status: "completed" },
      select: { id: true, riders: true, distanceKm: true },
    });

    // Load all rider profiles for name matching
    const allProfiles = await prisma.riderProfile.findMany({
      where: { mergedIntoId: null },
      select: { id: true, name: true },
    });

    // Build name→profileId lookup (case-insensitive, trimmed)
    const nameToProfileId = new Map<string, string>();
    for (const p of allProfiles) {
      nameToProfileId.set(p.name.toLowerCase().trim(), p.id);
    }

    // Get all existing participations for quick lookup
    const existingParticipations = await prisma.rideParticipation.findMany({
      select: { riderProfileId: true, rideId: true },
    });
    const existingKeys = new Set(
      existingParticipations.map((p) => `${p.riderProfileId}:${p.rideId}`)
    );

    // Create missing RideParticipation records
    let createdParticipations = 0;
    for (const ride of allRides) {
      const riderNames: string[] = safeJsonParse(ride.riders, []);
      for (const name of riderNames) {
        const profileId = nameToProfileId.get(name.toLowerCase().trim());
        if (!profileId) continue; // No matching profile found
        const key = `${profileId}:${ride.id}`;
        if (existingKeys.has(key)) continue; // Already has a record

        // Create missing participation with default 5 points
        await prisma.rideParticipation.create({
          data: {
            riderProfileId: profileId,
            rideId: ride.id,
            points: 5,
            droppedOut: false,
          },
        });
        existingKeys.add(key);
        createdParticipations++;
      }
    }

    // 2b. Propagate superadmin and core_member roles from User → RiderProfile
    // These privileged roles should always be reflected on the rider profile
    const privilegedUsers = await prisma.user.findMany({
      where: {
        role: { in: ["superadmin", "core_member"] },
        linkedRiderId: { not: null },
      },
      select: { role: true, linkedRiderId: true },
    });
    let privilegedSynced = 0;
    for (const u of privilegedUsers) {
      if (!u.linkedRiderId) continue;
      const updated = await prisma.riderProfile.updateMany({
        where: { id: u.linkedRiderId, role: { not: u.role } },
        data: { role: u.role },
      });
      privilegedSynced += updated.count;
    }

    // 3. Upgrade users with "rider" role who have participations → "t2w_rider"
    const ridersToUpgrade = await prisma.user.findMany({
      where: {
        role: "rider",
        linkedRiderId: { not: null },
      },
      select: { id: true, linkedRiderId: true },
    });

    const upgradeIds: string[] = [];
    for (const u of ridersToUpgrade) {
      if (!u.linkedRiderId) continue;
      const participationCount = await prisma.rideParticipation.count({
        where: { riderProfileId: u.linkedRiderId },
      });
      if (participationCount > 0) {
        upgradeIds.push(u.id);
      }
    }

    let upgradedCount = 0;
    if (upgradeIds.length > 0) {
      const result = await prisma.user.updateMany({
        where: { id: { in: upgradeIds } },
        data: { role: "t2w_rider" },
      });
      upgradedCount = result.count;

      // Also sync RiderProfile.role for upgraded users
      const upgradedUsers = await prisma.user.findMany({
        where: { id: { in: upgradeIds }, linkedRiderId: { not: null } },
        select: { linkedRiderId: true },
      });
      const riderIdsToUpgrade = upgradedUsers.map((u) => u.linkedRiderId!);
      if (riderIdsToUpgrade.length > 0) {
        await prisma.riderProfile.updateMany({
          where: { id: { in: riderIdsToUpgrade }, role: "rider" },
          data: { role: "t2w_rider" },
        });
      }
    }

    // 4. Also upgrade RiderProfiles that have participations but no linked User
    // (riders who haven't registered yet but have ride history)
    const profilesWithParticipation = await prisma.riderProfile.findMany({
      where: {
        role: "rider",
        mergedIntoId: null,
        participations: { some: {} },
      },
      select: { id: true },
    });
    if (profilesWithParticipation.length > 0) {
      await prisma.riderProfile.updateMany({
        where: { id: { in: profilesWithParticipation.map((p) => p.id) } },
        data: { role: "t2w_rider" },
      });
    }

    // 5. Downgrade users with "t2w_rider" who have NO participations → "rider"
    const t2wRiders = await prisma.user.findMany({
      where: { role: "t2w_rider" },
      select: { id: true, linkedRiderId: true },
    });

    const downgradeIds: string[] = [];
    for (const u of t2wRiders) {
      if (!u.linkedRiderId) {
        downgradeIds.push(u.id);
        continue;
      }
      const participationCount = await prisma.rideParticipation.count({
        where: { riderProfileId: u.linkedRiderId },
      });
      if (participationCount === 0) {
        downgradeIds.push(u.id);
      }
    }

    let downgradedCount = 0;
    if (downgradeIds.length > 0) {
      const result = await prisma.user.updateMany({
        where: { id: { in: downgradeIds } },
        data: { role: "rider" },
      });
      downgradedCount = result.count;

      // Also sync RiderProfile.role for downgraded users
      const downgradedUsers = await prisma.user.findMany({
        where: { id: { in: downgradeIds }, linkedRiderId: { not: null } },
        select: { linkedRiderId: true },
      });
      const riderIdsToDowngrade = downgradedUsers.map((u) => u.linkedRiderId!);
      if (riderIdsToDowngrade.length > 0) {
        await prisma.riderProfile.updateMany({
          where: { id: { in: riderIdsToDowngrade }, role: "t2w_rider" },
          data: { role: "rider" },
        });
      }
    }

    // 6. Also downgrade RiderProfiles with "t2w_rider" that have NO participations
    const profilesWithoutParticipation = await prisma.riderProfile.findMany({
      where: {
        role: "t2w_rider",
        mergedIntoId: null,
        participations: { none: {} },
      },
      select: { id: true },
    });
    if (profilesWithoutParticipation.length > 0) {
      await prisma.riderProfile.updateMany({
        where: { id: { in: profilesWithoutParticipation.map((p) => p.id) } },
        data: { role: "rider" },
      });
    }

    // 7. Recalculate stats for all users with linked profiles
    const allLinkedUsers = await prisma.user.findMany({
      where: { linkedRiderId: { not: null } },
      select: { id: true, linkedRiderId: true },
    });

    for (const u of allLinkedUsers) {
      if (!u.linkedRiderId) continue;
      const participations = await prisma.rideParticipation.findMany({
        where: { riderProfileId: u.linkedRiderId },
        include: { ride: { select: { distanceKm: true } } },
      });
      const totalKm = participations.reduce((sum, p) => sum + p.ride.distanceKm, 0);
      await prisma.user.update({
        where: { id: u.id },
        data: { totalKm, ridesCompleted: participations.length },
      });
    }

    return NextResponse.json({
      success: true,
      clearedDropouts: clearedDropouts.count,
      privilegedRolesSynced: privilegedSynced,
      createdMissingParticipations: createdParticipations,
      upgradedToT2WRider: upgradedCount,
      downgradedToRider: downgradedCount,
      profilesUpgraded: profilesWithParticipation.length,
      profilesDowngraded: profilesWithoutParticipation.length,
    });
  } catch (error) {
    console.error("[T2W] Sync roles error:", error);
    return NextResponse.json({ error: "Failed to sync roles" }, { status: 500 });
  }
}
