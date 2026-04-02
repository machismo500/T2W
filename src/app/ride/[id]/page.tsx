import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { RideDetailPage } from "@/components/rides/RideDetailPage";
import { safeJsonParse } from "@/lib/json-utils";

// All ride pages are dynamic (data from DB)
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;

  let ride: {
    title: string; rideNumber: string; type: string; status: string;
    startLocation: string; endLocation: string; distanceKm: number;
    maxRiders: number; fee: number; description: string; id: string;
    startingPoint: string | null; leadRider: string; posterUrl: string | null;
  } | null = null;
  let registeredRiders = 0;

  try {
    const r = await prisma.ride.findUnique({
      where: { id },
      include: { registrations: { select: { id: true } } },
    });
    if (r) {
      ride = r;
      registeredRiders = r.registrations.length;
    }
  } catch {
    // DB may not be available during build
  }

  if (!ride) {
    return {
      title: "Ride Not Found | Tales on 2 Wheels",
      description: "The requested ride could not be found.",
    };
  }

  const BASE_URL = "https://taleson2wheels.com";
  const title = `${ride.rideNumber} ${ride.title} | ${ride.startLocation} to ${ride.endLocation} Motorcycle Ride`;
  const description = `${ride.description} ${ride.distanceKm} km ${ride.type} ride from ${ride.startLocation} to ${ride.endLocation}. ${ride.status === "upcoming" ? `Register now - only ${ride.maxRiders - registeredRiders} spots left! Fee: ₹${ride.fee}` : `${registeredRiders} riders participated.`} Organised by Tales on 2 Wheels.`;
  const url = `${BASE_URL}/ride/${ride.id}`;

  return {
    title,
    description,
    keywords: [
      `${ride.endLocation} motorcycle ride`,
      `${ride.startLocation} to ${ride.endLocation} bike ride`,
      `T2W ride ${ride.rideNumber}`,
      `${ride.title} motorcycle tour`,
      "Tales on 2 Wheels",
      "T2W rides",
      "motorcycle group ride India",
    ],
    openGraph: {
      type: "article",
      siteName: "Tales on 2 Wheels",
      title: `${ride.rideNumber} ${ride.title} | Tales on 2 Wheels`,
      description: `${ride.distanceKm} km ${ride.type} ride: ${ride.startLocation} → ${ride.endLocation}. ${ride.status === "upcoming" ? "Register now!" : "View ride details."}`,
      url,
    },
    twitter: {
      card: "summary_large_image",
      site: "@TalesOn2Wheels",
      title: `${ride.rideNumber} ${ride.title} | T2W`,
      description: `${ride.distanceKm} km ${ride.type} ride: ${ride.startLocation} → ${ride.endLocation}`,
    },
    alternates: { canonical: url },
  };
}

async function RideEventSchema({ rideId }: { rideId: string }) {
  let ride: Record<string, unknown> | null = null;
  try {
    const r = await prisma.ride.findUnique({
      where: { id: rideId },
      include: { registrations: { select: { id: true } } },
    });
    if (r) {
      ride = {
        ...r,
        startDate: r.startDate.toISOString(),
        endDate: r.endDate.toISOString(),
        registeredRiders: r.registrations.length,
      };
    }
  } catch {
    return null;
  }

  if (!ride) return null;

  const registeredRiders = (ride.registeredRiders as number) || 0;
  const schema = {
    "@context": "https://schema.org",
    "@type": "Event",
    "@id": `https://taleson2wheels.com/ride/${ride.id}#event`,
    name: `${ride.rideNumber} ${ride.title} - Tales on 2 Wheels`,
    description: ride.description,
    url: `https://taleson2wheels.com/ride/${ride.id}`,
    startDate: ride.startDate,
    endDate: ride.endDate,
    eventStatus: ride.status === "upcoming"
      ? "https://schema.org/EventScheduled"
      : "https://schema.org/EventCompleted",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: (ride.startingPoint as string) || (ride.startLocation as string),
      address: {
        "@type": "PostalAddress",
        addressLocality: (ride.startLocation as string).split(",")[0].trim(),
        addressRegion: (ride.startLocation as string).split(",")[1]?.trim() || "Karnataka",
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
      availability: registeredRiders < (ride.maxRiders as number)
        ? "https://schema.org/InStock"
        : "https://schema.org/SoldOut",
      url: `https://taleson2wheels.com/ride/${ride.id}`,
      validFrom: new Date().toISOString(),
    },
    maximumAttendeeCapacity: ride.maxRiders,
    remainingAttendeeCapacity: (ride.maxRiders as number) - registeredRiders,
    image: {
      "@type": "ImageObject",
      url: (ride.posterUrl as string)
        ? ((ride.posterUrl as string).startsWith("http")
            ? (ride.posterUrl as string)
            : `https://taleson2wheels.com${ride.posterUrl}`)
        : "https://taleson2wheels.com/og-image.jpg",
      width: 1200,
      height: 630,
    },
    performer: ride.leadRider ? { "@type": "Person", name: ride.leadRider } : undefined,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export default async function RidePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <>
      <RideEventSchema rideId={id} />
      <RideDetailPage rideId={id} />
    </>
  );
}
