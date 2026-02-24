import type { Metadata } from "next";
import { RidesPage } from "@/components/rides/RidesPage";

export const metadata: Metadata = {
  title: "T2W Tales - All Rides",
  description:
    "Browse all Tales on 2 Wheels rides. Register for upcoming motorcycle adventures, view past ride highlights, and discover your next journey across India.",
  openGraph: {
    title: "T2W Tales - All Rides | Tales on 2 Wheels",
    description:
      "Browse upcoming and past motorcycle rides. Register for your next adventure with T2W.",
  },
};

export default function Rides() {
  return <RidesPage />;
}
