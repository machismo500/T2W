/**
 * Seed script to migrate static rider-profiles data into the database.
 *
 * Usage:
 *   npx tsx scripts/seed-rider-profiles.ts
 *
 * Requires DATABASE_URL in environment (or .env file).
 *
 * This script:
 *   1. Creates RiderProfile records from the static rider-profiles data
 *   2. Creates Ride records from past-rides data (if not already present)
 *   3. Creates RideParticipation records linking riders to rides
 *   4. Links existing User accounts to RiderProfiles by email match
 *
 * Safe to run repeatedly — skips existing records.
 */

import "dotenv/config";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../generated/prisma";
import ws from "ws";

if (!process.env.DATABASE_URL) {
  console.warn(
    "[seed-riders] WARNING: DATABASE_URL is not set — skipping rider seed.\n" +
    "Set DATABASE_URL in your environment or .env file."
  );
  process.exit(0);
}

neonConfig.webSocketConstructor = ws;

function cleanConnectionString(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.delete("channel_binding");
    u.searchParams.delete("sslmode");
    return u.toString();
  } catch {
    return url
      .replace(/[?&]channel_binding=[^&]*/g, "")
      .replace(/[?&]sslmode=[^&]*/g, "")
      .replace(/\?&/, "?")
      .replace(/\?$/, "");
  }
}

const connectionString = cleanConnectionString(process.env.DATABASE_URL);
const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

// Dynamic import of static data (these use @/ aliases, so we import from relative paths)
async function loadStaticData() {
  // We need to load the static data files. Since they use TypeScript and may
  // have path aliases, we'll import them using relative paths from the project root.
  const riderProfilesModule = await import("../src/data/rider-profiles");
  const pastRidesModule = await import("../src/data/past-rides");
  return {
    riderProfiles: riderProfilesModule.riderProfiles,
    pastRides: pastRidesModule.pastRides,
  };
}

async function main() {
  console.log("[seed-riders] Seeding rider profiles and participation data...\n");

  const { riderProfiles, pastRides } = await loadStaticData();

  // Step 1: Ensure all past rides exist in the DB
  console.log(`  [rides] Processing ${pastRides.length} rides...`);
  let ridesCreated = 0;
  let ridesSkipped = 0;

  for (const ride of pastRides) {
    const existing = await prisma.ride.findUnique({
      where: { rideNumber: ride.rideNumber },
    });
    if (existing) {
      // Update existing ride with new fields if missing
      if (!existing.organisedBy && ride.organisedBy) {
        await prisma.ride.update({
          where: { id: existing.id },
          data: {
            organisedBy: ride.organisedBy || null,
            accountsBy: ride.accountsBy || null,
            meetupTime: ride.meetupTime || null,
            rideStartTime: ride.rideStartTime || null,
            startingPoint: ride.startingPoint || null,
            riders: ride.riders ? JSON.stringify(ride.riders) : null,
          },
        });
      }
      ridesSkipped++;
      continue;
    }
    try {
      await prisma.ride.create({
        data: {
          id: ride.id,
          title: ride.title,
          rideNumber: ride.rideNumber,
          type: ride.type,
          status: ride.status || "completed",
          startDate: new Date(ride.startDate),
          endDate: new Date(ride.endDate),
          startLocation: ride.startLocation,
          endLocation: ride.endLocation,
          route: JSON.stringify(ride.route),
          distanceKm: ride.distanceKm,
          maxRiders: ride.maxRiders || 40,
          difficulty: ride.difficulty || "moderate",
          description: ride.description || "",
          highlights: JSON.stringify(ride.highlights || []),
          fee: ride.fee || 0,
          leadRider: ride.leadRider || "",
          sweepRider: ride.sweepRider || "",
          organisedBy: ride.organisedBy || null,
          accountsBy: ride.accountsBy || null,
          meetupTime: ride.meetupTime || null,
          rideStartTime: ride.rideStartTime || null,
          startingPoint: ride.startingPoint || null,
          riders: ride.riders ? JSON.stringify(ride.riders) : null,
        },
      });
      ridesCreated++;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`    [warn] Failed to create ride ${ride.rideNumber}: ${msg}`);
    }
  }
  console.log(`    Created: ${ridesCreated}, Skipped: ${ridesSkipped}`);

  // Step 2: Create RiderProfile records
  console.log(`\n  [riders] Processing ${riderProfiles.length} rider profiles...`);
  let profilesCreated = 0;
  let profilesSkipped = 0;

  // Map old static rider IDs to new DB rider profile IDs
  const riderIdMap = new Map<string, string>();

  for (const profile of riderProfiles) {
    // Check if a rider profile with this email already exists
    const existingProfiles = await prisma.riderProfile.findMany({
      where: { email: profile.email.toLowerCase().trim() },
    });

    if (existingProfiles.length > 0) {
      riderIdMap.set(profile.id, existingProfiles[0].id);
      profilesSkipped++;
      continue;
    }

    try {
      const created = await prisma.riderProfile.create({
        data: {
          name: profile.name,
          email: profile.email.toLowerCase().trim(),
          phone: profile.phone || "",
          address: profile.address || "",
          emergencyContact: profile.emergencyContact || "",
          emergencyPhone: profile.emergencyPhone || "",
          bloodGroup: profile.bloodGroup || "",
          joinDate: new Date(profile.joinDate),
          ridesOrganized: profile.ridesOrganized || 0,
          sweepsDone: profile.sweepsDone || 0,
          pilotsDone: profile.pilotsDone || 0,
        },
      });
      riderIdMap.set(profile.id, created.id);
      profilesCreated++;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`    [warn] Failed to create profile for ${profile.name}: ${msg}`);
    }
  }
  console.log(`    Created: ${profilesCreated}, Skipped: ${profilesSkipped}`);

  // Step 3: Create RideParticipation records
  console.log("\n  [participation] Creating ride participation records...");
  let participationsCreated = 0;
  let participationsSkipped = 0;

  // Build a ride ID lookup (rideNumber -> DB ride id)
  const rideMap = new Map<string, string>();
  const allRides = await prisma.ride.findMany({ select: { id: true, rideNumber: true } });
  for (const r of allRides) {
    rideMap.set(r.rideNumber, r.id);
    // Also map by the static IDs (ride-t2w-xxx)
  }

  // Also build static ride ID -> rideNumber mapping
  for (const staticRide of pastRides) {
    const dbRide = rideMap.get(staticRide.rideNumber);
    if (dbRide) {
      rideMap.set(staticRide.id, dbRide);
    }
  }

  for (const profile of riderProfiles) {
    const dbRiderProfileId = riderIdMap.get(profile.id);
    if (!dbRiderProfileId) continue;

    for (const rp of profile.ridesParticipated) {
      const dbRideId = rideMap.get(rp.rideId) || rideMap.get(rp.rideNumber);
      if (!dbRideId) {
        continue;
      }

      // Check if participation already exists
      const existing = await prisma.rideParticipation.findUnique({
        where: {
          riderProfileId_rideId: {
            riderProfileId: dbRiderProfileId,
            rideId: dbRideId,
          },
        },
      });

      if (existing) {
        participationsSkipped++;
        continue;
      }

      try {
        await prisma.rideParticipation.create({
          data: {
            riderProfileId: dbRiderProfileId,
            rideId: dbRideId,
            points: rp.points || 5,
          },
        });
        participationsCreated++;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn(`    [warn] Failed to create participation ${profile.name} -> ${rp.rideNumber}: ${msg}`);
      }
    }
  }
  console.log(`    Created: ${participationsCreated}, Skipped: ${participationsSkipped}`);

  // Step 4: Link existing User accounts to RiderProfiles by email
  console.log("\n  [linking] Linking existing user accounts to rider profiles...");
  let usersLinked = 0;

  const allUsers = await prisma.user.findMany({
    select: { id: true, email: true, linkedRiderId: true },
  });

  for (const user of allUsers) {
    if (user.linkedRiderId) continue; // already linked

    const matchingProfile = await prisma.riderProfile.findFirst({
      where: {
        email: user.email.toLowerCase().trim(),
        mergedIntoId: null, // don't link to merged profiles
      },
    });

    if (matchingProfile) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          linkedRiderId: matchingProfile.id,
          totalKm: (await prisma.rideParticipation.findMany({
            where: { riderProfileId: matchingProfile.id },
            include: { ride: true },
          })).reduce((sum, p) => sum + p.ride.distanceKm, 0),
          ridesCompleted: await prisma.rideParticipation.count({
            where: { riderProfileId: matchingProfile.id },
          }),
        },
      });
      usersLinked++;
    }
  }
  console.log(`    Users linked: ${usersLinked}`);

  console.log("\n[seed-riders] Done!");
}

main()
  .catch((e) => {
    console.error("[seed-riders] Seed failed (non-fatal):", e.message || e);
    process.exit(0);
  })
  .finally(() => prisma.$disconnect());
