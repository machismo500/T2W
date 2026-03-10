/**
 * Seed script to create badge tiers in the database.
 *
 * Usage:
 *   npx tsx scripts/seed-badges.ts
 *
 * Safe to run repeatedly — uses upsert.
 */

import "dotenv/config";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../generated/prisma";
import ws from "ws";

if (!process.env.DATABASE_URL) {
  console.warn("[seed-badges] WARNING: DATABASE_URL is not set — skipping badge seed.");
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

const BADGE_TIERS = [
  {
    tier: "SILVER",
    name: "Silver Rider",
    description: "Completed 1,000 km with T2W. The journey has just begun!",
    minKm: 1000,
    icon: "shield",
    color: "#C0C0C0",
  },
  {
    tier: "GOLD",
    name: "Gold Rider",
    description: "Completed 5,000 km with T2W. A seasoned road warrior!",
    minKm: 5000,
    icon: "award",
    color: "#FFD700",
  },
  {
    tier: "PLATINUM",
    name: "Platinum Rider",
    description: "Completed 15,000 km with T2W. The road knows your name!",
    minKm: 15000,
    icon: "star",
    color: "#E5E4E2",
  },
  {
    tier: "DIAMOND",
    name: "Diamond Rider",
    description: "Completed 30,000 km with T2W. A legend in the making!",
    minKm: 30000,
    icon: "gem",
    color: "#B9F2FF",
  },
  {
    tier: "ACE",
    name: "Ace Rider",
    description: "Completed 50,000 km with T2W. Master of the open road!",
    minKm: 50000,
    icon: "zap",
    color: "#FF6B35",
  },
  {
    tier: "CONQUEROR",
    name: "Conqueror",
    description: "Completed 100,000 km with T2W. You have conquered every horizon!",
    minKm: 100000,
    icon: "crown",
    color: "#9B59B6",
  },
];

async function main() {
  console.log("[seed-badges] Seeding badge tiers...\n");

  for (const badge of BADGE_TIERS) {
    await prisma.badge.upsert({
      where: { tier: badge.tier },
      update: {
        name: badge.name,
        description: badge.description,
        minKm: badge.minKm,
        icon: badge.icon,
        color: badge.color,
      },
      create: badge,
    });
    console.log(`  [badge] ${badge.tier}: ${badge.name} (${badge.minKm.toLocaleString()} km)`);
  }

  // Auto-award badges to existing users based on their totalKm
  console.log("\n  [awards] Checking existing users for badge eligibility...");
  const allBadges = await prisma.badge.findMany({ orderBy: { minKm: "asc" } });
  const users = await prisma.user.findMany({
    where: { totalKm: { gt: 0 } },
    select: { id: true, name: true, totalKm: true },
  });

  let awarded = 0;
  for (const user of users) {
    for (const badge of allBadges) {
      if (user.totalKm >= badge.minKm) {
        try {
          await prisma.userBadge.upsert({
            where: { userId_badgeId: { userId: user.id, badgeId: badge.id } },
            update: {},
            create: { userId: user.id, badgeId: badge.id },
          });
          awarded++;
        } catch {
          // Skip if constraint fails
        }
      }
    }
  }
  console.log(`    Awarded ${awarded} badges to ${users.length} users`);

  console.log("\n[seed-badges] Done!");
}

main()
  .catch((e) => {
    console.error("[seed-badges] Seed failed (non-fatal):", e.message || e);
    process.exit(0);
  })
  .finally(() => prisma.$disconnect());
