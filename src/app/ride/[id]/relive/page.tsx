import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ReliveRoot } from "@/components/relive/ReliveRoot";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    headless?: string;
    duration?: string;
    orientation?: string;
    exportId?: string;
  }>;
}

export default async function RelivePage({ params, searchParams }: Props) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const user = await getCurrentUser();

  const ride = await prisma.ride.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      rideNumber: true,
      startDate: true,
      endDate: true,
      startLocation: true,
      endLocation: true,
      registrations: user
        ? {
            where: { userId: user.id },
            select: { approvalStatus: true },
          }
        : undefined,
      liveSession: {
        select: {
          id: true,
          status: true,
          startedAt: true,
          endedAt: true,
          leadRiderId: true,
          elevationGainM: true,
        },
      },
    },
  });

  if (!ride) notFound();

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="rounded-2xl border border-t2w-border bg-t2w-surface p-8 text-center">
          <h1 className="font-display text-2xl font-bold text-white">
            Sign in to view the Relive
          </h1>
          <p className="mt-3 text-sm text-t2w-muted">
            Only registered riders and the T2W team can play the ride flyover.
          </p>
        </div>
      </div>
    );
  }

  const isAdmin = user.role === "superadmin" || user.role === "core_member";
  const isRegistrant = (ride.registrations || []).some(
    (r) => r.approvalStatus !== "rejected"
  );
  if (!isAdmin && !isRegistrant) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="rounded-2xl border border-t2w-border bg-t2w-surface p-8 text-center">
          <h1 className="font-display text-2xl font-bold text-white">
            Relive is for ride participants
          </h1>
          <p className="mt-3 text-sm text-t2w-muted">
            Register and join this ride to unlock the flyover video.
          </p>
        </div>
      </div>
    );
  }

  const headless = sp.headless === "1" || sp.headless === "true";
  const orientation = sp.orientation === "portrait" ? "portrait" : "landscape";
  const requestedDuration = Number(sp.duration);
  const durationSec =
    Number.isFinite(requestedDuration) && requestedDuration > 0
      ? requestedDuration
      : Number(process.env.RELIVE_DEFAULT_DURATION_SEC) || 60;

  return (
    <div className={headless ? "h-screen w-screen bg-black" : "min-h-screen bg-black"}>
      {!headless && (
        <div className="mx-auto max-w-6xl px-4 pt-6">
          <Link
            href={`/ride/${id}`}
            className="inline-flex items-center gap-2 text-sm text-t2w-muted hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to ride
          </Link>
        </div>
      )}
      <ReliveRoot
        rideId={ride.id}
        rideTitle={ride.title}
        rideNumber={ride.rideNumber}
        startDate={ride.startDate.toISOString()}
        startLocation={ride.startLocation}
        endLocation={ride.endLocation}
        sessionEnded={ride.liveSession?.status === "ended"}
        elevationGainM={ride.liveSession?.elevationGainM ?? null}
        headless={headless}
        orientation={orientation}
        durationSec={durationSec}
        exportId={sp.exportId}
      />
    </div>
  );
}
