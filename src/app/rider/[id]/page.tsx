import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { RiderProfilePage } from "@/components/rider/RiderProfilePage";

// Use dynamic rendering since rider data comes from DB now
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;

  // Query DB for rider metadata
  let riderName: string | null = null;
  let ridesCompleted = 0;
  let totalKm = 0;

  try {
    const profile = await prisma.riderProfile.findUnique({
      where: { id },
      include: {
        participations: {
          include: { ride: { select: { distanceKm: true } } },
        },
      },
    });
    if (profile) {
      riderName = profile.name;
      ridesCompleted = profile.participations.length;
      totalKm = profile.participations.reduce(
        (sum: number, p: (typeof profile.participations)[number]) => sum + p.ride.distanceKm,
        0
      );
    }
  } catch {
    // DB may not be available during build
  }

  if (!riderName) {
    return {
      title: "Rider Profile | Tales on 2 Wheels",
      description: "View rider profile on Tales on 2 Wheels motorcycle community.",
    };
  }

  const title = `${riderName} - T2W Rider Profile | Tales on 2 Wheels`;
  const description = `${riderName} has completed ${ridesCompleted} rides covering ${totalKm.toLocaleString()} km with Tales on 2 Wheels motorcycle community. View ride history and achievements.`;

  return {
    title,
    description,
    openGraph: {
      title: `${riderName} | Tales on 2 Wheels Rider`,
      description,
      images: [
        {
          url: "/og-image.jpg",
          width: 1200,
          height: 630,
          alt: `${riderName} - Tales on 2 Wheels Rider Profile`,
        },
      ],
    },
    alternates: {
      canonical: `https://taleson2wheels.com/rider/${id}`,
    },
  };
}

export default async function RiderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RiderProfilePage riderId={id} />;
}
