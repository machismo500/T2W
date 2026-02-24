import type { Metadata } from "next";
import { RideDetailPage } from "@/components/rides/RideDetailPage";
import { mockRides } from "@/data/mock";

export function generateStaticParams() {
  return mockRides.map((ride) => ({ id: ride.id }));
}

export function generateMetadata({
  params,
}: {
  params: { id: string };
}): Metadata {
  const ride = mockRides.find((r) => r.id === params.id);
  return {
    title: ride ? `${ride.title} - T2W Ride` : "Ride Details",
    description: ride?.description || "View ride details on Tales on 2 Wheels",
  };
}

export default function RideDetail({ params }: { params: { id: string } }) {
  return <RideDetailPage rideId={params.id} />;
}
