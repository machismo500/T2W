import type { Metadata } from "next";
import { DashboardPage } from "@/components/dashboard/DashboardPage";

export const metadata: Metadata = {
  title: "Profile - Rider Dashboard",
  description:
    "Your personal T2W dashboard. Track your rides, kilometers covered, motorcycles, and achievements in one place.",
};

export default function Dashboard() {
  return <DashboardPage />;
}
