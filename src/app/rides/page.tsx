import type { Metadata } from "next";
import { RidesPage } from "@/components/rides/RidesPage";

export const metadata: Metadata = {
  title:
    "Motorcycle Rides & Tours in India | Upcoming Group Rides from Bangalore",
  description:
    "Browse all T2W motorcycle rides - day trips from Bangalore to Nandi Hills & Mysore, weekend getaways to Coorg & Chikmagalur, multi-day tours to Hampi, Goa, Rajasthan & Spiti Valley. Register for upcoming rides now!",
  keywords: [
    "motorcycle rides Bangalore",
    "bike tours India",
    "upcoming motorcycle rides",
    "Nandi Hills ride",
    "Coorg bike ride",
    "Chikmagalur motorcycle tour",
    "Hampi bike trip",
    "Western Ghats motorcycle ride",
    "Rajasthan motorcycle tour",
    "Spiti Valley bike ride",
    "group motorcycle rides near me",
    "weekend bike rides from Bangalore",
  ],
  openGraph: {
    title: "Motorcycle Rides & Tours | Tales on 2 Wheels",
    description:
      "Browse upcoming and past motorcycle rides from Bangalore & across India. Register for your next adventure with T2W.",
  },
  alternates: {
    canonical: "https://taleson2wheels.com/rides",
  },
};

export default function Rides() {
  return <RidesPage />;
}
