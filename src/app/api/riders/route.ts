import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getRolePermissions } from "@/lib/role-permissions";

// Compute a cutoff date from period string (e.g., "6m", "1y")
function periodCutoffDate(period: string | null): Date | null {
  if (!period || period === "all") return null;
  const now = new Date();
  if (period === "6m") {
    now.setMonth(now.getMonth() - 6);
    return now;
  }
  if (period === "1y") {
    now.setFullYear(now.getFullYear() - 1);
    return now;
  }
  return null;
}

// GET /api/riders - list all rider profiles with participation stats
// Access: public for leaderboard data (PII stripped); privileged users get full data
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();

    // Determine privilege level
    const isPrivileged = user?.role === "superadmin" || user?.role === "core_member";

    // For non-privileged non-admin access: previously required t2w_rider + canViewMemberDirectory.
    // Now we allow public read for leaderboard stats (names, scores, avatars — no PII).
    // PII fields (email, phone, address, emergency*) are stripped for non-privileged callers.

    const searchParams = req.nextUrl.searchParams;
    const search = searchParams.get("search") || "";
    const includemerged = searchParams.get("includemerged") === "true";
    const period = searchParams.get("period");
    const cutoff = periodCutoffDate(period);

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
          include: { ride: { select: { id: true, rideNumber: true, title: true, startDate: true, distanceKm: true, type: true } } },
        },
        linkedUsers: {
          select: { role: true },
          take: 1,
        },
      },
      orderBy: { name: "asc" },
    });

    const riders = profiles.map((p: typeof profiles[number]) => {
      // Exclude dropped-out riders from active stats, and filter by period
      const activeParticipations = p.participations.filter(
        (pp: typeof p.participations[number]) =>
          !pp.droppedOut && (!cutoff || pp.ride.startDate >= cutoff)
      );
      return {
        id: p.id,
        name: p.name,
        // PII: only expose to privileged callers
        email: isPrivileged ? p.email : undefined,
        phone: isPrivileged ? p.phone : undefined,
        address: isPrivileged ? p.address : undefined,
        emergencyContact: isPrivileged ? p.emergencyContact : undefined,
        emergencyPhone: isPrivileged ? p.emergencyPhone : undefined,
        bloodGroup: isPrivileged ? p.bloodGroup : undefined,
        joinDate: p.joinDate.toISOString(),
        avatarUrl: p.avatarUrl,
        ridesOrganized: p.ridesOrganized,
        sweepsDone: p.sweepsDone,
        pilotsDone: p.pilotsDone,
        mergedIntoId: p.mergedIntoId,
        userRole: p.role !== "rider" ? p.role : (p.linkedUsers[0]?.role || null),
        ridesCompleted: activeParticipations.length,
        dayRides: activeParticipations.filter((pp: typeof p.participations[number]) => pp.ride.type === "day").length,
        weekendRides: activeParticipations.filter((pp: typeof p.participations[number]) => pp.ride.type === "weekend").length,
        multiDayRides: activeParticipations.filter((pp: typeof p.participations[number]) => pp.ride.type === "multi-day").length,
        expeditionRides: activeParticipations.filter((pp: typeof p.participations[number]) => pp.ride.type === "expedition").length,
        totalKm: activeParticipations.reduce((sum: number, pp: typeof p.participations[number]) => sum + pp.ride.distanceKm, 0),
        totalPoints: activeParticipations.reduce((sum: number, pp: typeof p.participations[number]) => sum + pp.points, 0),
        ridesParticipated: isPrivileged ? activeParticipations.map((pp: typeof p.participations[number]) => ({
          rideId: pp.ride.id,
          rideNumber: pp.ride.rideNumber,
          rideTitle: pp.ride.title,
          rideDate: pp.ride.startDate.toISOString(),
          distanceKm: pp.ride.distanceKm,
          points: pp.points,
          droppedOut: pp.droppedOut,
        })) : undefined,
        participationMap: isPrivileged ? Object.fromEntries(
          activeParticipations.map((pp: typeof p.participations[number]) => [pp.ride.id, pp.points])
        ) : undefined,
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
