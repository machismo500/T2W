import type { Metadata } from "next";
import { RiderArenaPage } from "@/components/riders/RiderArenaPage";

export const revalidate = 30; // ISR: revalidate every 30 seconds

export const metadata: Metadata = {
  title: "Rider Arena | Leaderboard & Stats | Tales on 2 Wheels",
  description:
    "See where you stand among T2W riders. Explore the leaderboard, rider stats, badges earned, and kilometers conquered. The arena where legends are forged on the open road.",
  keywords: [
    "motorcycle rider leaderboard",
    "T2W rider stats",
    "motorcycle riding achievements",
    "rider rankings Bangalore",
    "Tales on 2 Wheels riders",
  ],
  openGraph: {
    title: "Rider Arena | Tales on 2 Wheels",
    description:
      "Explore the T2W rider leaderboard — stats, badges, and rankings for every rider in the community.",
  },
  alternates: {
    canonical: "https://taleson2wheels.com/riders",
  },
};

export default function Riders() {
  return <RiderArenaPage />;
}
