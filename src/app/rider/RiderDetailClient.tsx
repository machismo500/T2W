"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Bike } from "lucide-react";
import { RiderProfilePage } from "@/components/rider/RiderProfilePage";

function RiderDetailInner() {
  const searchParams = useSearchParams();
  const riderId = searchParams.get("id") || "";

  if (!riderId) {
    return (
      <div className="flex min-h-screen items-center justify-center pt-24">
        <div className="text-center">
          <Bike className="mx-auto h-16 w-16 text-t2w-border" />
          <h2 className="mt-4 font-display text-2xl font-bold text-white">
            No rider specified
          </h2>
          <p className="mt-2 text-t2w-muted">
            Please select a rider from a ride page.
          </p>
        </div>
      </div>
    );
  }

  return <RiderProfilePage riderId={riderId} />;
}

export function RiderDetailClient() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center pt-24">
          <Bike className="mx-auto h-12 w-12 animate-pulse text-t2w-accent" />
        </div>
      }
    >
      <RiderDetailInner />
    </Suspense>
  );
}
