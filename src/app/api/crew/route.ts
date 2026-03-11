import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Known crew members with their emails and display roles.
// These are the core team members who should always appear in The Crew section,
// regardless of whether they have a User account or what DB role they have.
const CREW_CONFIG = [
  { email: "roshan.manuel@gmail.com", displayRole: "Core Member" },
  { email: "san.nh007@gmail.com", displayRole: "Core Member" },
  { email: "jaytrivedi.b@gmail.com", displayRole: "Core Member" },
  { email: "shreyasbm77@gmail.com", displayRole: "Core Member" },
  { email: "harishkumarmr27@gmail.com", displayRole: "Core Member" },
];

// GET /api/crew - list crew members with avatar URLs
export async function GET() {
  try {
    const crewEmails = CREW_CONFIG.map((c) => c.email.toLowerCase());

    // 1. Find User accounts for crew members (by email)
    const crewUsers = await prisma.user.findMany({
      where: {
        email: { in: crewEmails, mode: "insensitive" },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        linkedRiderId: true,
        riderProfile: {
          select: { id: true, avatarUrl: true },
        },
      },
    });

    // 2. Find RiderProfiles for crew members (covers those without User accounts)
    const crewProfiles = await prisma.riderProfile.findMany({
      where: {
        email: { in: crewEmails, mode: "insensitive" },
        mergedIntoId: null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
      },
    });

    // Build crew list in CREW_CONFIG order, deduplicating by email
    const crew = CREW_CONFIG.map((config) => {
      const emailLower = config.email.toLowerCase();
      const user = crewUsers.find((u) => u.email.toLowerCase() === emailLower);
      const profile = crewProfiles.find((p) => p.email.toLowerCase() === emailLower);

      const riderId = user?.linkedRiderId || user?.riderProfile?.id || profile?.id || null;
      const avatarUrl = user?.riderProfile?.avatarUrl || profile?.avatarUrl || null;
      const name = user?.name || profile?.name || config.email;

      return {
        id: user?.id || profile?.id || config.email,
        name,
        role: config.displayRole,
        linkedRiderId: riderId,
        avatarUrl,
      };
    });

    return NextResponse.json({ crew });
  } catch (error) {
    console.error("[T2W] Crew error:", error);
    return NextResponse.json({ error: "Failed to load crew" }, { status: 500 });
  }
}
