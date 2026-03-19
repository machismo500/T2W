import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/stats - public homepage stats
export async function GET() {
  try {
    const [activeRiders, completedRides, totalKmResult, rides] =
      await Promise.all([
        // Count unique rider profiles (non-merged) that have at least one participation
        prisma.riderProfile.count({
          where: {
            mergedIntoId: null,
            participations: { some: {} },
          },
        }),
        // Count completed rides
        prisma.ride.count({
          where: { status: "completed" },
        }),
        // Sum all distanceKm from completed rides (each ride's distance counted once)
        prisma.ride.aggregate({
          where: { status: "completed" },
          _sum: { distanceKm: true },
        }),
        // Get all completed rides to extract unique countries from locations
        prisma.ride.findMany({
          where: { status: "completed" },
          select: { startLocation: true, endLocation: true },
        }),
      ]);

    // Extract unique countries from ride locations
    // Locations typically end with country or state, e.g. "Bangalore, Karnataka" or "Kathmandu, Nepal"
    const countryKeywords = new Set<string>();
    const knownCountries: Record<string, string> = {
      nepal: "Nepal",
      thailand: "Thailand",
      bhutan: "Bhutan",
      "sri lanka": "Sri Lanka",
      myanmar: "Myanmar",
      indonesia: "Indonesia",
      vietnam: "Vietnam",
      cambodia: "Cambodia",
      laos: "Laos",
      malaysia: "Malaysia",
    };

    // Default: India is always counted
    countryKeywords.add("India");

    for (const ride of rides) {
      const locations = `${ride.startLocation} ${ride.endLocation}`.toLowerCase();
      for (const [keyword, country] of Object.entries(knownCountries)) {
        if (locations.includes(keyword)) {
          countryKeywords.add(country);
        }
      }
    }

    const totalKm = Math.round(totalKmResult._sum.distanceKm || 0);

    return NextResponse.json({
      activeRiders,
      ridesCompleted: completedRides,
      kmsCovered: totalKm,
      countriesRidden: countryKeywords.size,
    });
  } catch (error) {
    console.error("[stats] Error:", error);
    // Return fallback values so the homepage never breaks
    return NextResponse.json({
      activeRiders: 0,
      ridesCompleted: 0,
      kmsCovered: 0,
      countriesRidden: 0,
    });
  }
}
