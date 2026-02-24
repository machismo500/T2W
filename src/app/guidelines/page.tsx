import type { Metadata } from "next";
import { GuidelinesPage } from "@/components/shared/GuidelinesPage";

export const metadata: Metadata = {
  title: "Riding Guidelines & Tips",
  description:
    "T2W group riding guidelines, safety tips, bike preparation checklists, and riding techniques from experienced motorcycle riders. Stay safe, ride smart.",
  openGraph: {
    title: "Riding Guidelines & Tips | Tales on 2 Wheels",
    description:
      "Essential group riding guidelines and safety tips for motorcycle riders.",
  },
};

export default function Guidelines() {
  return <GuidelinesPage />;
}
