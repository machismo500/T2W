import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { pastRides } from "@/data/past-rides";

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

function computeRideRoleStats(riderName: string): { pilotsDone: number; sweepsDone: number; ridesOrganized: number } {
  let pilotsDone = 0, sweepsDone = 0, ridesOrganized = 0;
  for (const ride of pastRides) {
    if (ride.leadRider && crewNameMatchesRider(ride.leadRider, riderName)) pilotsDone++;
    if (ride.sweepRider && crewNameMatchesRider(ride.sweepRider, riderName)) sweepsDone++;
    if (ride.organisedBy && crewNameMatchesRider(ride.organisedBy, riderName)) ridesOrganized++;
  }
  return { pilotsDone, sweepsDone, ridesOrganized };
}

// GET /api/riders - list all rider profiles with participation stats
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const search = searchParams.get("search") || "";
    const includemerged = searchParams.get("includemerged") === "true";

    const where: Record<string, unknown> = {};
    if (!includemerged) {
      where.mergedIntoId = null;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    const profiles = await prisma.riderProfile.findMany({
      where,
      include: {
        participations: {
          include: { ride: { select: { id: true, rideNumber: true, title: true, startDate: true, distanceKm: true } } },
        },
        linkedUsers: {
          select: { role: true },
          take: 1,
        },
      },
      orderBy: { name: "asc" },
    });

    // Also count from DB rides not in static data
    const dbRides = await prisma.ride.findMany({
      select: { id: true, leadRider: true, sweepRider: true },
    });
    const staticRideIds = new Set(pastRides.map((r) => r.id));
    const extraDbRides = dbRides.filter((r) => !staticRideIds.has(r.id));

    const riders = profiles.map((p: typeof profiles[number]) => {
      const stats = computeRideRoleStats(p.name);
      // Add DB-only rides
      for (const ride of extraDbRides) {
        if (ride.leadRider && crewNameMatchesRider(ride.leadRider, p.name)) stats.pilotsDone++;
        if (ride.sweepRider && crewNameMatchesRider(ride.sweepRider, p.name)) stats.sweepsDone++;
      }
      return {
      id: p.id,
      name: p.name,
      email: p.email,
      phone: p.phone,
      address: p.address,
      emergencyContact: p.emergencyContact,
      emergencyPhone: p.emergencyPhone,
      bloodGroup: p.bloodGroup,
      joinDate: p.joinDate.toISOString(),
      avatarUrl: p.avatarUrl,
      ...stats,
      mergedIntoId: p.mergedIntoId,
      userRole: p.role !== "rider" ? p.role : (p.linkedUsers[0]?.role || null),
      ridesCompleted: p.participations.length,
      totalKm: p.participations.reduce((sum: number, pp: typeof p.participations[number]) => sum + pp.ride.distanceKm, 0),
      totalPoints: p.participations.reduce((sum: number, pp: typeof p.participations[number]) => sum + pp.points, 0),
      ridesParticipated: p.participations.map((pp: typeof p.participations[number]) => ({
        rideId: pp.ride.id,
        rideNumber: pp.ride.rideNumber,
        rideTitle: pp.ride.title,
        rideDate: pp.ride.startDate.toISOString(),
        distanceKm: pp.ride.distanceKm,
        points: pp.points,
      })),
      participationMap: Object.fromEntries(
        p.participations.map((pp: typeof p.participations[number]) => [pp.ride.id, pp.points])
      ),
    };
    });

    return NextResponse.json({ riders });
  } catch (error) {
    console.error("[T2W] List riders error:", error);
    return NextResponse.json({ error: "Failed to load riders" }, { status: 500 });
  }
}

// POST /api/riders - create a new rider profile (admin only)
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "superadmin" && user.role !== "core_member")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const data = await req.json();
    const { name, email, phone, address, emergencyContact, emergencyPhone, bloodGroup } = data;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const profile = await prisma.riderProfile.create({
      data: {
        name: name.trim(),
        email: (email || "").toLowerCase().trim(),
        phone: phone || "",
        address: address || "",
        emergencyContact: emergencyContact || "",
        emergencyPhone: emergencyPhone || "",
        bloodGroup: bloodGroup || "",
      },
    });

    // Auto-link if a user with this email exists
    if (profile.email) {
      const matchingUser = await prisma.user.findUnique({
        where: { email: profile.email },
      });
      if (matchingUser && !matchingUser.linkedRiderId) {
        await prisma.user.update({
          where: { id: matchingUser.id },
          data: { linkedRiderId: profile.id },
        });
      }
    }

    return NextResponse.json({ profile });
  } catch (error) {
    console.error("[T2W] Create rider error:", error);
    return NextResponse.json({ error: "Failed to create rider" }, { status: 500 });
  }
}
