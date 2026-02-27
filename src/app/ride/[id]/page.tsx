import { RideDetailClient } from "./RideDetailClient";

export function generateStaticParams() {
  return [];
}

export default async function RideDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RideDetailClient rideId={id} />;
}
