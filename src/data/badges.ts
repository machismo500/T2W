import { Badge } from "@/types";

export const BADGE_TIERS: Badge[] = [
  {
    tier: "SILVER",
    name: "Silver Rider",
    description: "Completed 1,000 km with T2W. The journey has just begun!",
    minKm: 1000,
    icon: "shield",
    color: "#C0C0C0",
  },
  {
    tier: "GOLD",
    name: "Gold Rider",
    description: "Completed 5,000 km with T2W. A seasoned road warrior!",
    minKm: 5000,
    icon: "award",
    color: "#FFD700",
  },
  {
    tier: "PLATINUM",
    name: "Platinum Rider",
    description: "Completed 15,000 km with T2W. The road knows your name!",
    minKm: 15000,
    icon: "star",
    color: "#E5E4E2",
  },
  {
    tier: "DIAMOND",
    name: "Diamond Rider",
    description: "Completed 30,000 km with T2W. A legend in the making!",
    minKm: 30000,
    icon: "gem",
    color: "#B9F2FF",
  },
  {
    tier: "ACE",
    name: "Ace Rider",
    description: "Completed 50,000 km with T2W. Master of the open road!",
    minKm: 50000,
    icon: "zap",
    color: "#FF6B35",
  },
  {
    tier: "CONQUEROR",
    name: "Conqueror",
    description:
      "Completed 100,000 km with T2W. You have conquered every horizon!",
    minKm: 100000,
    icon: "crown",
    color: "#9B59B6",
  },
];
