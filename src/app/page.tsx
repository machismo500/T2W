import type { Metadata } from "next";
import { HeroSection } from "@/components/home/HeroSection";
import { UpcomingRides } from "@/components/home/UpcomingRides";
import { NotificationBoard } from "@/components/home/NotificationBoard";
import { AboutContact } from "@/components/home/AboutContact";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title:
    "Bangalore Motorcycle Club & Bike Group | Tales on 2 Wheels - T2W",
  description:
    "Join T2W — Bangalore's most active motorcycle club & bike group. 500+ riders, 120+ rides. Group rides from Bengaluru to Ladakh, Goa, Coorg, Nepal & more. Register free today!",
  keywords: [
    // Primary local targets
    "motorcycle club in Bangalore",
    "motorcycle club in Bengaluru",
    "motorcycle club Bangalore",
    "motorcycle club Bengaluru",
    "motorcycle groups in Bangalore",
    "motorcycle groups in Bengaluru",
    "bike groups in Bangalore",
    "bike groups in Bengaluru",
    "bike club Bangalore",
    "bike club Bengaluru",
    "Bangalore motorcycle club",
    "Bengaluru motorcycle club",
    "biker club Bangalore",
    "biker group Bangalore",
    "bike riding group Bangalore",
    "two wheeler club Bangalore",
    "motorcycle riding group Bengaluru",
    "join motorcycle club Bangalore",
    "best motorcycle club Bangalore",
    // Secondary
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
    "biker community registration India",
    "upcoming motorcycle rides Bangalore",
    "bike group Bangalore Instagram",
    "Tales on 2 Wheels upcoming rides",
    "T2W registration",
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
    "@id": `https://taleson2wheels.com/ride/${ride.id}#event`,
    name: ride.title,
    description: ride.description,
    startDate: ride.startDate.toISOString(),
    endDate: ride.endDate.toISOString(),
    url: `https://taleson2wheels.com/ride/${ride.id}`,
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
      "@id": "https://taleson2wheels.com/#organization",
    },
    offers: {
      "@type": "Offer",
      price: ride.fee,
      priceCurrency: "INR",
      url: `https://taleson2wheels.com/ride/${ride.id}`,
      availability: "https://schema.org/InStock",
      validFrom: new Date().toISOString(),
    },
    maximumAttendeeCapacity: ride.maxRiders,
    image: {
      "@type": "ImageObject",
      url: "https://taleson2wheels.com/og-image.jpg",
      width: 1200,
      height: 630,
    },
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
