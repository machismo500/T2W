import Link from "next/link";
import { ArrowLeft, Film } from "lucide-react";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function RelivePage({ params }: Props) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Link
        href={`/ride/${id}`}
        className="mb-6 inline-flex items-center gap-2 text-sm text-t2w-muted hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to ride
      </Link>

      <div className="rounded-2xl border border-t2w-border bg-t2w-surface p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-t2w-accent/15 text-t2w-accent">
          <Film className="h-7 w-7" />
        </div>
        <h1 className="font-display text-2xl font-bold text-white">
          Animated ride video — coming soon
        </h1>
        <p className="mt-3 text-sm text-t2w-muted">
          We&rsquo;re building a Relive-style flyover that turns this ride into a
          1080p video (horizontal or vertical). The data model and APIs are in
          place; the renderer ships in a follow-up release once the tile-licensing
          and worker-infra decisions land.
        </p>
        <p className="mt-3 text-xs text-t2w-muted">
          Until then, you can download the GPX from the ride summary and create a
          video in Relive, GPX Studio, or Google Earth Studio.
        </p>
      </div>
    </div>
  );
}
