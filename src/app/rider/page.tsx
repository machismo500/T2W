import type { Metadata } from "next";
import { RiderDetailClient } from "./RiderDetailClient";

export const metadata: Metadata = {
  title: "Rider Profile | Tales on 2 Wheels",
  description:
    "View rider profile, ride history, and achievements on Tales on 2 Wheels.",
  openGraph: {
    title: "Rider Profile | Tales on 2 Wheels",
    description: "View rider profile and ride history.",
  },
};

export default function RiderPage() {
  return <RiderDetailClient />;
}
