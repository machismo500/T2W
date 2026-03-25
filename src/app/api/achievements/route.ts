import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Name normalization for matching crew names to rider profile names
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
}

const crewNameAliases: Record<string, string> = {
  "suren": "surendar p velu",
  "surendar": "surendar p velu",
  "surendar velu": "surendar p velu",
};

function crewNameMatchesRider(crewName: string, riderName: string): boolean {
  const crewLower = crewName.toLowerCase().trim();
  const riderLower = riderName.toLowerCase().trim();
  if (crewLower === riderLower) return true;
  if (normalizeName(crewName) === normalizeName(riderName)) return true;
  const alias = crewNameAliases[crewLower];
  if (alias && normalizeName(alias) === normalizeName(riderName)) return true;
  if (!crewLower.includes(" ")) {
    const riderFirstName = riderLower.split(/\s+/)[0];
    if (crewLower === riderFirstName) return true;
  }
  return false;
}

// GET /api/achievements - compute period achievement data
export async function GET() {
  try {
    // Read achievement settings
    const settingsRow = await prisma.siteSettings.findUnique({
      where: { key: "achievement_settings" },
    });

    if (!settingsRow) {
      return NextResponse.json({ configured: false, riders: [] });
    }

    const settings = JSON.parse(settingsRow.value) as {
      periodStart: string;
      periodEnd: string;
      pointsPerParticipation: number;
      pointsPerOrganize: number;
      pointsPerSweep: number;
      thresholdPercent: number;
    };

    if (!settings.periodStart || !settings.periodEnd) {
      return NextResponse.json({ configured: false, riders: [] });
    }

    const periodStart = new Date(settings.periodStart);
    const periodEnd = new Date(settings.periodEnd);
    // Set periodEnd to end of that day
    periodEnd.setHours(23, 59, 59, 999);

    // Get all rides in the period
    const ridesInPeriod = await prisma.ride.findMany({
      where: {
        startDate: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
      select: {
        id: true,
        rideNumber: true,
        title: true,
        startDate: true,
        leadRider: true,
        sweepRider: true,
        organisedBy: true,
      },
      orderBy: { startDate: "asc" },
    });

    const totalRidesInPeriod = ridesInPeriod.length;
    const maxPossiblePerRide = settings.pointsPerParticipation + settings.pointsPerOrganize + settings.pointsPerSweep;
    const maxPossible = totalRidesInPeriod * maxPossiblePerRide;
    const threshold = maxPossible * (settings.thresholdPercent / 100);

    // Get all rider profiles with participations in the period
    const profiles = await prisma.riderProfile.findMany({
      where: { mergedIntoId: null },
      include: {
        participations: {
          where: {
            droppedOut: false,
            ride: {
              startDate: {
                gte: periodStart,
                lte: periodEnd,
              },
            },
          },
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

    const riderResults = profiles
      .map((p) => {
        const ridesCompletedInPeriod = p.participations.length;

        // Compute organize and sweep counts in the period
        let ridesOrganizedInPeriod = 0;
        let sweepsDoneInPeriod = 0;
        for (const ride of ridesInPeriod) {
          if (ride.organisedBy && crewNameMatchesRider(ride.organisedBy, p.name)) {
            ridesOrganizedInPeriod++;
          }
          if (ride.sweepRider && crewNameMatchesRider(ride.sweepRider, p.name)) {
            sweepsDoneInPeriod++;
          }
        }

        const participationPts = ridesCompletedInPeriod * settings.pointsPerParticipation;
        const organizePts = ridesOrganizedInPeriod * settings.pointsPerOrganize;
        const sweepPts = sweepsDoneInPeriod * settings.pointsPerSweep;
        const totalPts = participationPts + organizePts + sweepPts;
        const highlighted = totalPts >= threshold;

        return {
          id: p.id,
          name: p.name,
          avatarUrl: p.avatarUrl,
          userRole: p.role !== "rider" ? p.role : (p.linkedUsers[0]?.role || null),
          ridesCompletedInPeriod,
          ridesOrganizedInPeriod,
          sweepsDoneInPeriod,
          participationPts,
          organizePts,
          sweepPts,
          totalPts,
          highlighted,
        };
      })
      // Only include riders who have some points
      .filter((r) => r.totalPts > 0)
      .sort((a, b) => b.totalPts - a.totalPts);

    return NextResponse.json({
      configured: true,
      periodStart: settings.periodStart,
      periodEnd: settings.periodEnd,
      pointsPerParticipation: settings.pointsPerParticipation,
      pointsPerOrganize: settings.pointsPerOrganize,
      pointsPerSweep: settings.pointsPerSweep,
      thresholdPercent: settings.thresholdPercent,
      totalRidesInPeriod,
      maxPossible,
      threshold,
      rides: ridesInPeriod.map((r) => ({
        id: r.id,
        rideNumber: r.rideNumber,
        title: r.title,
        startDate: r.startDate.toISOString(),
      })),
      riders: riderResults,
    });
  } catch (error) {
    console.error("[T2W] Achievements GET error:", error);
    return NextResponse.json(
      { error: "Failed to compute achievements" },
      { status: 500 }
    );
  }
}
