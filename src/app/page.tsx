import type { Metadata } from "next";
import { HeroSection } from "@/components/home/HeroSection";
import { UpcomingRides } from "@/components/home/UpcomingRides";
import { NotificationBoard } from "@/components/home/NotificationBoard";
import { AboutContact } from "@/components/home/AboutContact";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title:
    "T2W - Tales on 2 Wheels | Motorcycle Rides in Bangalore & India",
  description:
    "Join India's #1 motorcycle riding community. Group rides to Ladakh, Nepal, Thailand, Dhanushkodi, Munnar, Goa, Rajasthan across India. 500+ riders, 120+ rides completed, 2.5 lakh km covered. Register for upcoming rides today!",
  keywords: [
    "motorcycle rides Bangalore",
    "bike rides near Bangalore",
    "motorcycle group rides India",
    "Nandi Hills motorcycle ride",
    "Coorg bike ride from Bangalore",
    "weekend bike rides Bangalore",
    "motorcycle community India",
    "T2W rides",
    "Tales on 2 Wheels",
    "best motorcycle rides in India",
    "motorcycle tours Karnataka",
    "Bangalore bikers group",
    "Royal Enfield rides Bangalore",
  ],
  alternates: {
    canonical: "https://taleson2wheels.com",
  },
};

async function EventSchemas() {
  let upcomingRides: Array<{
    id: string; title: string; description: string; startDate: Date;
    endDate: Date; startLocation: string; fee: number; maxRiders: number;
    leadRider: string;
  }> = [];

  try {
    upcomingRides = await prisma.ride.findMany({
      where: { status: "upcoming" },
      select: {
        id: true, title: true, description: true, startDate: true,
        endDate: true, startLocation: true, fee: true, maxRiders: true, leadRider: true,
      },
    });
  } catch {
    // DB unavailable
  }

  if (upcomingRides.length === 0) return null;

  const schemas = upcomingRides.map((ride) => ({
    "@context": "https://schema.org",
    "@type": "Event",
    name: ride.title,
    description: ride.description,
    startDate: ride.startDate.toISOString(),
    endDate: ride.endDate.toISOString(),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: ride.startLocation,
      address: {
        "@type": "PostalAddress",
        addressLocality: ride.startLocation.split(",")[0].trim(),
        addressCountry: "IN",
      },
    },
    organizer: {
      "@type": "Organization",
      name: "Tales on 2 Wheels",
      url: "https://taleson2wheels.com",
    },
    offers: {
      "@type": "Offer",
      price: ride.fee,
      priceCurrency: "INR",
      url: `https://taleson2wheels.com/ride/${ride.id}`,
      validFrom: "2026-01-01",
    },
    maximumAttendeeCapacity: ride.maxRiders,
    image: "https://taleson2wheels.com/og-image.jpg",
    performer: { "@type": "Person", name: ride.leadRider },
  }));

  return (
    <>
      {schemas.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
    </>
  );
}

export default function Home() {
  return (
    <>
      <EventSchemas />
      <HeroSection />
      <UpcomingRides />
      <NotificationBoard />
      <AboutContact />
    </>
  );
}
