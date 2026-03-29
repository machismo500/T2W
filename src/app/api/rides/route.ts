import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { computeRideStatus } from "@/lib/ride-status";
import { safeJsonParse } from "@/lib/json-utils";

// GET /api/rides - list all rides
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get("status"); // upcoming | completed | all
    const limit = parseInt(searchParams.get("limit") || "0") || 0;

    const rides = await prisma.ride.findMany({
      include: {
        participations: {
          select: { riderProfileId: true, droppedOut: true },
        },
        registrations: {
          select: { id: true, approvalStatus: true },
        },
      },
      orderBy: { startDate: "desc" },
    });

    let result = rides.map((r) => ({
      id: r.id,
      title: r.title,
      rideNumber: r.rideNumber,
      type: r.type,
      status: computeRideStatus(r.startDate, r.endDate, r.status),
      startDate: r.startDate.toISOString(),
      endDate: r.endDate.toISOString(),
      startLocation: r.startLocation,
      startLocationUrl: r.startLocationUrl,
      endLocation: r.endLocation,
      endLocationUrl: r.endLocationUrl,
      route: safeJsonParse(r.route, []),
      distanceKm: r.distanceKm,
      maxRiders: r.maxRiders,
      registeredRiders: r.registrations.filter((reg) => reg.approvalStatus === "confirmed").length
        || r.participations.filter((p) => !p.droppedOut).length
        || (safeJsonParse(r.riders, []) as string[]).length,
      activeRegistrations: r.registrations.filter((reg) => reg.approvalStatus === "pending" || reg.approvalStatus === "confirmed").length
        || r.participations.filter((p) => !p.droppedOut).length
        || (safeJsonParse(r.riders, []) as string[]).length,
      difficulty: r.difficulty,
      description: r.description,
      highlights: safeJsonParse(r.highlights, []),
      posterUrl: r.posterUrl,
      fee: r.fee,
      leadRider: r.leadRider,
      sweepRider: r.sweepRider,
      organisedBy: r.organisedBy,
      accountsBy: r.accountsBy,
      meetupTime: r.meetupTime,
      rideStartTime: r.rideStartTime,
      startingPoint: r.startingPoint,
      riders: safeJsonParse(r.riders, []),
      regOpenCore: r.regOpenCore?.toISOString() || null,
      regOpenT2w: r.regOpenT2w?.toISOString() || null,
      regOpenRider: r.regOpenRider?.toISOString() || null,
    }));

    // Apply status filter after dynamic status computation
    if (status && status !== "all") {
      result = result.filter((r) => r.status === status);
    }

    // Apply limit after filtering
    if (limit > 0) {
      result = result.slice(0, limit);
    }

    return NextResponse.json({ rides: result });
  } catch (error) {
    console.error("[T2W] List rides error:", error);
    return NextResponse.json({ error: "Failed to load rides" }, { status: 500 });
  }
}

// POST /api/rides - create a new ride (admin only)
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "superadmin" && user.role !== "core_member")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (user.role === "core_member") {
      const { getRolePermissions } = await import("@/lib/role-permissions");
      const rolePerms = await getRolePermissions();
      if (!rolePerms.core_member.canCreateRide) {
        return NextResponse.json({ error: "Core members do not have permission to create rides" }, { status: 403 });
      }
    }

    const data = await req.json();

    // Auto-generate ride number based on total ride count
    const totalRides = await prisma.ride.count();
    const rideNumber = data.rideNumber || `#${String(totalRides + 1).padStart(3, "0")}`;

    const ride = await prisma.ride.create({
      data: {
        title: data.title,
        rideNumber,
        type: data.type || "day",
        status: data.status || "upcoming",
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        startLocation: data.startLocation,
        startLocationUrl: data.startLocationUrl || null,
        endLocation: data.endLocation,
        endLocationUrl: data.endLocationUrl || null,
        route: JSON.stringify(data.route || []),
        distanceKm: data.distanceKm || 0,
        maxRiders: data.maxRiders || 40,
        difficulty: data.difficulty || "moderate",
        description: data.description || "",
        highlights: JSON.stringify(data.highlights || []),
        posterUrl: data.posterUrl || null,
        fee: data.fee || 0,
        leadRider: data.leadRider || "",
        sweepRider: data.sweepRider || "",
        organisedBy: data.organisedBy || null,
        accountsBy: data.accountsBy || null,
        meetupTime: data.meetupTime || null,
        rideStartTime: data.rideStartTime || null,
        startingPoint: data.startingPoint || null,
        riders: data.riders ? JSON.stringify(data.riders) : null,
        regFormSettings: data.regFormSettings ? JSON.stringify(data.regFormSettings) : null,
        regOpenCore: data.regOpenCore ? new Date(data.regOpenCore) : null,
        regOpenT2w: data.regOpenT2w ? new Date(data.regOpenT2w) : null,
        regOpenRider: data.regOpenRider ? new Date(data.regOpenRider) : null,
      },
    });

    return NextResponse.json({ ride: { ...ride, rideNumber } });
  } catch (error) {
    console.error("[T2W] Create ride error:", error);
    return NextResponse.json({ error: "Failed to create ride" }, { status: 500 });
  }
}

