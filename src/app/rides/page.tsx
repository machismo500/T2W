import type { Metadata } from "next";
import { RidesPage } from "@/components/rides/RidesPage";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title:
    "Motorcycle Rides & Tours in India | Upcoming Group Rides from Bangalore",
  description:
    "Browse all T2W motorcycle rides - day trips from Bangalore, weekend getaways to Coorg & Chikmagalur, multi-day tours to Hampi, Goa, Rajasthan & Spiti Valley. Register for upcoming rides now!",
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

async function UpcomingRidesSchema() {
  let upcomingRides: Array<{
    id: string; title: string; rideNumber: string; description: string;
    startDate: Date; endDate: Date; startLocation: string;
    fee: number; maxRiders: number;
  }> = [];

  try {
    upcomingRides = await prisma.ride.findMany({
      where: { status: "upcoming" },
      select: {
        id: true, title: true, rideNumber: true, description: true,
        startDate: true, endDate: true, startLocation: true,
        fee: true, maxRiders: true,
      },
    });
  } catch {
    // DB unavailable
  }

  if (upcomingRides.length === 0) return null;

  const schema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Upcoming Motorcycle Rides - Tales on 2 Wheels",
    description: "Browse and register for upcoming motorcycle group rides from Bangalore and across India.",
    numberOfItems: upcomingRides.length,
    itemListElement: upcomingRides.map((ride, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "Event",
        name: `${ride.rideNumber} ${ride.title}`,
        description: ride.description,
        startDate: ride.startDate.toISOString(),
        endDate: ride.endDate.toISOString(),
        eventStatus: "https://schema.org/EventScheduled",
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        location: {
          "@type": "Place",
          name: ride.startLocation,
          address: { "@type": "PostalAddress", addressLocality: ride.startLocation.split(",")[0].trim(), addressCountry: "IN" },
        },
        organizer: { "@type": "Organization", name: "Tales on 2 Wheels", url: "https://taleson2wheels.com" },
        offers: {
          "@type": "Offer",
          price: ride.fee,
          priceCurrency: "INR",
          url: `https://taleson2wheels.com/ride/${ride.id}`,
        },
        maximumAttendeeCapacity: ride.maxRiders,
        image: "https://taleson2wheels.com/og-image.jpg",
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export default function Rides() {
  return (
    <>
      <UpcomingRidesSchema />
      <RidesPage />
    </>
  );
}
