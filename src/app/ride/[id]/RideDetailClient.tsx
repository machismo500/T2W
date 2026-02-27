"use client";

import { RideDetailPage } from "@/components/rides/RideDetailPage";

export function RideDetailClient({ rideId }: { rideId: string }) {
  return <RideDetailPage rideId={rideId} />;
}
