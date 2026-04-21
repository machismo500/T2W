import type { Metadata } from "next";
import Script from "next/script";
import { RiderArenaPage } from "@/components/riders/RiderArenaPage";

export const revalidate = 30;

export const metadata: Metadata = {
  title: "Rider Arena | Leaderboard & Stats | Tales on 2 Wheels",
  description:
    "Meet Bangalore's top motorcycle riders. Explore the T2W leaderboard — total kilometers ridden, rides completed, badges earned, and rankings. Who's the top rider in Bengaluru's motorcycle community?",
  keywords: [
    "motorcycle rider leaderboard Bangalore",
    "top motorcycle riders Bengaluru",
    "T2W rider stats",
    "motorcycle riding achievements India",
    "rider rankings Bangalore",
    "Tales on 2 Wheels riders",
    "best motorcycle riders Karnataka",
    "biker profiles Bangalore",
    "motorcycle community members India",
    "riding kilometers tracker",
    "motorcycle badge system India",
    "T2W leaderboard",
    "motorcycle club members Bangalore",
    "iron rider bronze silver gold badge",
  ],
  openGraph: {
    title: "Rider Arena — Top Motorcycle Riders in Bangalore | T2W",
    description:
      "Explore the T2W rider leaderboard — stats, badges, kilometers, and rankings for every rider in Bangalore's premier motorcycle community.",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "T2W Rider Leaderboard — Bangalore Motorcycle Community",
      },
    ],
  },
  alternates: {
    canonical: "https://taleson2wheels.com/riders",
  },
};

const ridersPageSchema = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  "@id": "https://taleson2wheels.com/riders#webpage",
  name: "Rider Arena — T2W Motorcycle Community Leaderboard",
  description:
    "Leaderboard and profiles for all riders in Tales on 2 Wheels, Bangalore's most active motorcycle club. Track kilometers ridden, rides completed, and achievements.",
  url: "https://taleson2wheels.com/riders",
  isPartOf: { "@id": "https://taleson2wheels.com/#website" },
  about: { "@id": "https://taleson2wheels.com/#organization" },
  breadcrumb: {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://taleson2wheels.com" },
      { "@type": "ListItem", position: 2, name: "Rider Arena", item: "https://taleson2wheels.com/riders" },
    ],
  },
};

export default function Riders() {
  return (
    <>
      <Script
        id="riders-page-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ridersPageSchema) }}
      />
      <RiderArenaPage />
    </>
  );
}
