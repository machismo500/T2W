/**
 * Seed script to populate blogs and guidelines in the database.
 *
 * Usage:
 *   npx tsx scripts/seed-blogs-guidelines.ts
 *
 * Safe to run repeatedly — skips existing records.
 */

import "dotenv/config";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../generated/prisma";
import ws from "ws";

if (!process.env.DATABASE_URL) {
  console.warn("[seed] WARNING: DATABASE_URL is not set — skipping seed.");
  process.exit(0);
}

neonConfig.webSocketConstructor = ws;
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter } as never);

const blogs = [
  {
    id: "blog-1",
    title: "Himalayan Tales: 19 Days from Manali to Leh",
    excerpt: "The T2W Himalayan expedition - 3,300 km through the highest motorable passes in the world. A ride that changed everything.",
    content: "It started at 2:30 AM at Bangalore International Airport. 19 days, 3,300 km, and some of the most breathtaking landscapes on Earth. From Rohtang to Khardung La, through Pangong Lake and Nubra Valley - this is the story of T2W Ride #004, Himalayan Tales. Organised by Roshan Manuel with Suren as pilot and Harish Mysuru on sweep, this expedition tested every rider to their limits and beyond.",
    authorName: "Roshan Manuel",
    publishDate: new Date("2024-07-15"),
    tags: JSON.stringify(["himalayan", "expedition", "ladakh", "adventure"]),
    type: "official",
    readTime: 15,
    likes: 356,
  },
  {
    id: "blog-2",
    title: "Nepal Tales: Riding Through the Himalayas",
    excerpt: "1,950 km across Nepal - from Kathmandu to Pokhara and beyond. T2W's first international expedition.",
    content: "T2W Ride #016 took us across the border into Nepal for 18 incredible days. Starting May 1st 2025, we rode through Kathmandu valley, the Annapurna circuit roads, Pokhara's lakeside, and the winding mountain passes of the Himalayas. An international expedition that pushed boundaries and created memories for a lifetime.",
    authorName: "Roshan Manuel",
    publishDate: new Date("2025-06-01"),
    tags: JSON.stringify(["nepal", "expedition", "international", "adventure"]),
    type: "personal",
    readTime: 12,
    likes: 289,
  },
  {
    id: "blog-3",
    title: "Tales of Thailand: T2W Goes International Again",
    excerpt: "1,200 km through the Land of Smiles. From Bangkok to Chiang Mai on two wheels.",
    content: "After Nepal, T2W set its sights on Southeast Asia. Ride #023 - Tales of Thailand 2025, spanning October 31 to November 10, covered 1,200 km from Bangkok to Chiang Mai. Organised by Roshan Manuel, this expedition explored Thai temples, mountain roads, and street food culture on two wheels.",
    authorName: "Jay Trivedi",
    publishDate: new Date("2025-11-20"),
    tags: JSON.stringify(["thailand", "expedition", "international"]),
    type: "personal",
    readTime: 10,
    likes: 245,
  },
  {
    id: "blog-4",
    title: "Kambala 3.0: The Mangalore Run",
    excerpt: "800 km, 3 days, and the thrill of witnessing the ancient Kambala buffalo race in coastal Karnataka.",
    content: "T2W Ride #013 - Kambala 3.0 was a special one. Organised by Jay Trivedi, this 3-day ride from Bangalore to Mangalore covered 800 km and timed perfectly with the traditional Kambala buffalo race. Starting from Parle-G Toll at 5 AM with Jay as pilot and Harish Mysuru on sweep, we experienced the best of coastal Karnataka.",
    authorName: "Harish Mysuru",
    publishDate: new Date("2025-03-01"),
    tags: JSON.stringify(["coastal", "kambala", "mangalore", "culture"]),
    type: "personal",
    readTime: 8,
    likes: 198,
  },
  {
    id: "blog-5",
    title: "Top 10 T2W Rides: Our Greatest Hits So Far",
    excerpt: "From The Beginning (#001) to Kavvayi Island (#027) - looking back at 27 rides and counting.",
    content: "Two years, 27 rides, 140 riders, and thousands of kilometres. From our very first ride to Sakleshpur in March 2024 to the serene backwaters of Kavvayi Island in February 2026 - here's our definitive guide to the top 10 T2W rides that defined our brotherhood on two wheels.",
    authorName: "Shreyas BM",
    publishDate: new Date("2026-02-25"),
    tags: JSON.stringify(["bangalore", "routes", "guide", "best-of", "karnataka"]),
    type: "official",
    readTime: 10,
    likes: 412,
  },
];

const guidelines = [
  { id: "guide-1", title: "Pre-Ride Briefing", content: "Every T2W ride begins with a mandatory pre-ride briefing. This includes route overview, fuel stop planning, emergency protocols, hand signals review, and rider pairing assignments. Arrive at least 30 minutes before the scheduled departure time.", category: "group", icon: "clipboard" },
  { id: "guide-2", title: "Formation Riding", content: "T2W follows staggered formation on highways and single file on mountain roads. Maintain a 2-second gap from the rider directly ahead. The lead rider sets the pace; never overtake the lead rider. The sweep rider stays at the back at all times.", category: "group", icon: "users" },
  { id: "guide-3", title: "Hand Signals", content: "All T2W riders must know the standard hand signals: left turn (left arm extended), right turn (left arm bent up at 90 degrees), slow down (left arm extended down, palm facing back), stop (left arm bent down at 90 degrees), hazard on road (pointing to the ground), and single file (left index finger raised).", category: "group", icon: "hand" },
  { id: "guide-4", title: "Mandatory Safety Gear", content: "All riders must wear: ISI/ECE certified full-face helmet, riding jacket with armor, riding gloves, riding boots that cover ankles, and riding pants. Hi-visibility vests are recommended for dawn/dusk rides. Non-compliance will result in exclusion from the ride.", category: "safety", icon: "shield" },
  { id: "guide-5", title: "Bike Preparation", content: "Before every ride, perform T-CLOCS check: Tires & Wheels (pressure, tread), Controls (levers, cables, throttle), Lights & Electrics (headlight, tail, indicators), Oil & Fluids (engine oil, coolant, brake fluid), Chassis (frame, suspension), and Stands (side stand, center stand).", category: "maintenance", icon: "wrench" },
  { id: "guide-6", title: "Cornering Techniques", content: "Slow in, fast out. Reduce speed before entering a corner, not during. Look through the corner to where you want to go. Lean the bike, not your body, for better control. Avoid braking mid-corner. Gradually roll on throttle as you exit the turn.", category: "general", icon: "navigation" },
  { id: "guide-7", title: "Emergency Protocol", content: "In case of breakdown or accident: Pull over safely to the shoulder. Turn on hazard lights. Place a warning triangle 50m behind the bike. Inform the sweep rider immediately. Do not attempt to move an injured rider. Call emergency services if needed. The sweep rider carries a first-aid kit.", category: "safety", icon: "alert-triangle" },
  { id: "guide-8", title: "Fuel Management", content: "Always start a ride with a full tank. Know your bike's range and plan fuel stops accordingly. The ride leader will announce fuel stops. If you notice your fuel is running low, signal the group to stop. Carry a 1-liter emergency fuel reserve on long rides.", category: "general", icon: "fuel" },
];

async function main() {
  console.log("[seed] Seeding blogs...");
  for (const blog of blogs) {
    await prisma.blogPost.upsert({
      where: { id: blog.id },
      update: blog,
      create: blog,
    });
    console.log(`  ✓ Blog: ${blog.title}`);
  }

  console.log("\n[seed] Seeding guidelines...");
  for (const guide of guidelines) {
    await prisma.guideline.upsert({
      where: { id: guide.id },
      update: guide,
      create: guide,
    });
    console.log(`  ✓ Guideline: ${guide.title}`);
  }

  console.log("\n[seed] Done!");
}

main()
  .catch((e) => {
    console.error("[seed] Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
