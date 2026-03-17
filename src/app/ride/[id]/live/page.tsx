import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { LiveRidePage } from "@/components/rides/LiveRidePage";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;

  let title = "Live Ride Tracking | Tales on 2 Wheels";
  try {
    const ride = await prisma.ride.findUnique({
      where: { id },
      select: { title: true, rideNumber: true },
    });
    if (ride) {
      title = `${ride.rideNumber} ${ride.title} — Live Tracking | Tales on 2 Wheels`;
    }
  } catch {
    // DB may not be available during build
  }

  return {
    title,
    description: "Live GPS tracking for Tales on 2 Wheels ride",
  };
}

export default async function LiveRidePageWrapper({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let rideTitle = "Live Ride";
  try {
    const ride = await prisma.ride.findUnique({
      where: { id },
      select: { title: true, rideNumber: true },
    });
    if (ride) {
      rideTitle = `${ride.rideNumber} ${ride.title}`;
    }
  } catch {
    // DB may not be available during build
  }

  return <LiveRidePage rideId={id} rideTitle={rideTitle} />;
}
