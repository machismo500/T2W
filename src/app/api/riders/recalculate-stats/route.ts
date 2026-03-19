import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// Helper: normalize a name for matching (lowercase, collapse whitespace, strip non-alpha)
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
}

// POST /api/riders/recalculate-stats - recalculate sweep/pilot/organised counts from ride data
export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Load all rider profiles (non-merged)
    const profiles = await prisma.riderProfile.findMany({
      where: { mergedIntoId: null },
      select: { id: true, name: true },
    });

    // Known aliases: crew name in ride data → canonical profile name
    const nameAliases: Record<string, string> = {
      "suren": "surendar p velu",
      "surendar": "surendar p velu",
      "surendar velu": "surendar p velu",
    };

    // Build name → profile ID lookup (multiple name forms per profile)
    const nameToProfileId: Record<string, string> = {};
    const profileFirstNames: Record<string, string[]> = {}; // firstName → [profileIds]

    for (const p of profiles) {
      const exact = p.name.toLowerCase().trim();
      const norm = normalizeName(p.name);
      nameToProfileId[exact] = p.id;
      nameToProfileId[norm] = p.id;

      const firstName = p.name.split(/\s+/)[0].toLowerCase().trim();
      if (!profileFirstNames[firstName]) profileFirstNames[firstName] = [];
      profileFirstNames[firstName].push(p.id);
    }

    // For unique first names, also map first name → profile ID
    for (const [firstName, ids] of Object.entries(profileFirstNames)) {
      if (ids.length === 1) {
        nameToProfileId[firstName] = ids[0];
      }
    }

    // Register aliases
    for (const [alias, canonical] of Object.entries(nameAliases)) {
      if (nameToProfileId[canonical]) {
        nameToProfileId[alias] = nameToProfileId[canonical];
      }
    }

    // Helper: resolve a crew name to a profile ID
    function resolveProfileId(name: string | undefined): string | null {
      if (!name) return null;
      const exact = name.toLowerCase().trim();
      if (nameToProfileId[exact]) return nameToProfileId[exact];
      const norm = normalizeName(name);
      if (nameToProfileId[norm]) return nameToProfileId[norm];
      const firstName = name.split(/\s+/)[0].toLowerCase().trim();
      if (nameToProfileId[firstName]) return nameToProfileId[firstName];
      return null;
    }

    // Count stats from all DB rides
    const pilotCounts: Record<string, number> = {};
    const sweepCounts: Record<string, number> = {};
    const organizedCounts: Record<string, number> = {};

    const dbRides = await prisma.ride.findMany({
      select: { id: true, rideNumber: true, leadRider: true, sweepRider: true, organisedBy: true },
    });

    for (const ride of dbRides) {
      const leadId = resolveProfileId(ride.leadRider);
      const sweepId = resolveProfileId(ride.sweepRider);
      const orgId = resolveProfileId(ride.organisedBy || undefined);

      if (leadId) pilotCounts[leadId] = (pilotCounts[leadId] || 0) + 1;
      if (sweepId) sweepCounts[sweepId] = (sweepCounts[sweepId] || 0) + 1;
      if (orgId) organizedCounts[orgId] = (organizedCounts[orgId] || 0) + 1;
    }

    // Update all profiles
    const updates: Array<{ id: string; name: string; old: { p: number; s: number; o: number }; new: { p: number; s: number; o: number } }> = [];
    const allProfiles = await prisma.riderProfile.findMany({
      where: { mergedIntoId: null },
      select: { id: true, name: true, pilotsDone: true, sweepsDone: true, ridesOrganized: true },
    });

    for (const p of allProfiles) {
      const newPilots = pilotCounts[p.id] || 0;
      const newSweeps = sweepCounts[p.id] || 0;
      const newOrganized = organizedCounts[p.id] || 0;

      if (newPilots !== p.pilotsDone || newSweeps !== p.sweepsDone || newOrganized !== p.ridesOrganized) {
        updates.push({
          id: p.id,
          name: p.name,
          old: { p: p.pilotsDone, s: p.sweepsDone, o: p.ridesOrganized },
          new: { p: newPilots, s: newSweeps, o: newOrganized },
        });

        await prisma.riderProfile.update({
          where: { id: p.id },
          data: {
            pilotsDone: newPilots,
            sweepsDone: newSweeps,
            ridesOrganized: newOrganized,
          },
        });
      }
    }

    // Report unmatched names for debugging
    const unmatchedNames: string[] = [];
    for (const ride of dbRides) {
      if (ride.leadRider && !resolveProfileId(ride.leadRider)) unmatchedNames.push(`Lead: ${ride.leadRider} (${ride.rideNumber})`);
      if (ride.sweepRider && !resolveProfileId(ride.sweepRider)) unmatchedNames.push(`Sweep: ${ride.sweepRider} (${ride.rideNumber})`);
      if (ride.organisedBy && !resolveProfileId(ride.organisedBy)) unmatchedNames.push(`Organised: ${ride.organisedBy} (${ride.rideNumber})`);
    }

    return NextResponse.json({
      success: true,
      totalRides: dbRides.length,
      profilesUpdated: updates.length,
      changes: updates.map((u) => ({
        rider: u.name,
        pilotsDone: `${u.old.p} → ${u.new.p}`,
        sweepsDone: `${u.old.s} → ${u.new.s}`,
        ridesOrganized: `${u.old.o} → ${u.new.o}`,
      })),
      unmatchedNames: [...new Set(unmatchedNames)],
    });
  } catch (error) {
    console.error("[T2W] Recalculate stats error:", error);
    return NextResponse.json({ error: "Failed to recalculate stats" }, { status: 500 });
  }
}
