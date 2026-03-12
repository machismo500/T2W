import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/rides - list all rides
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get("status"); // upcoming | completed | all
    const limit = parseInt(searchParams.get("limit") || "0") || 0;

    const where: Record<string, unknown> = {};
    if (status && status !== "all") {
      where.status = status;
    }

    const rides = await prisma.ride.findMany({
      where,
      include: {
        participations: {
          select: { riderProfileId: true },
        },
        registrations: {
          select: { id: true },
        },
      },
      orderBy: { startDate: "desc" },
      ...(limit > 0 ? { take: limit } : {}),
    });

    const result = rides.map((r) => ({
      id: r.id,
      title: r.title,
      rideNumber: r.rideNumber,
      type: r.type,
      status: r.status,
      startDate: r.startDate.toISOString(),
      endDate: r.endDate.toISOString(),
      startLocation: r.startLocation,
      endLocation: r.endLocation,
      route: safeJsonParse(r.route, []),
      distanceKm: r.distanceKm,
      maxRiders: r.maxRiders,
      registeredRiders: r.registrations.length,
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
    }));

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

    const data = await req.json();

    // Auto-generate ride number
    const lastRide = await prisma.ride.findFirst({
      orderBy: { rideNumber: "desc" },
    });
    const lastNum = lastRide ? parseInt(lastRide.rideNumber.replace("#", "")) : 0;
    const rideNumber = `#${String(lastNum + 1).padStart(3, "0")}`;

    const ride = await prisma.ride.create({
      data: {
        title: data.title,
        rideNumber,
        type: data.type || "day",
        status: data.status || "upcoming",
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        startLocation: data.startLocation,
        endLocation: data.endLocation,
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
      },
    });

    return NextResponse.json({ ride: { ...ride, rideNumber } });
  } catch (error) {
    console.error("[T2W] Create ride error:", error);
    return NextResponse.json({ error: "Failed to create ride" }, { status: 500 });
  }
}

function safeJsonParse(value: string | null | undefined, fallback: unknown): unknown {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
