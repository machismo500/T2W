import type { Metadata } from "next";
import { HeroSection } from "@/components/home/HeroSection";
import { UpcomingRides } from "@/components/home/UpcomingRides";
import { NotificationBoard } from "@/components/home/NotificationBoard";
import { AboutContact } from "@/components/home/AboutContact";
import { mockRides } from "@/data/mock";

export const metadata: Metadata = {
  title:
    "T2W - Tales on 2 Wheels | Motorcycle Rides in Bangalore & India",
  description:
    "Join India's #1 motorcycle riding community. Group rides from Bangalore to Nandi Hills, Coorg, Chikmagalur, Hampi, Goa & across India. 500+ riders, 120+ rides completed, 2.5 lakh km covered. Register for upcoming rides today!",
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

function EventSchemas() {
  const upcomingRides = mockRides.filter((r) => r.status === "upcoming");
  const schemas = upcomingRides.map((ride) => ({
    "@context": "https://schema.org",
    "@type": "Event",
    name: ride.title,
    description: ride.description,
    startDate: ride.startDate,
    endDate: ride.endDate,
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
      availability:
        ride.registeredRiders < ride.maxRiders
          ? "https://schema.org/InStock"
          : "https://schema.org/SoldOut",
      url: `https://taleson2wheels.com/ride?id=${ride.id}`,
      validFrom: "2026-01-01",
    },
    maximumAttendeeCapacity: ride.maxRiders,
    remainingAttendeeCapacity: ride.maxRiders - ride.registeredRiders,
    image: "https://taleson2wheels.com/og-image.jpg",
    performer: {
      "@type": "Person",
      name: ride.leadRider,
    },
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
