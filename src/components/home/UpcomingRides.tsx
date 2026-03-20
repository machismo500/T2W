"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Calendar,
  MapPin,
  Users,
  ArrowRight,
  Clock,
  Gauge,
  Route,
  Bike,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { Ride } from "@/types";

function RideCard({ ride, featured }: { ride: Ride; featured?: boolean }) {
  const difficultyColors = {
    easy: "text-green-400 bg-green-400/10 border-green-400/20",
    moderate: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
    challenging: "text-orange-400 bg-orange-400/10 border-orange-400/20",
    extreme: "text-red-400 bg-red-400/10 border-red-400/20",
  };

  const typeLabels = {
    day: "Day Ride",
    weekend: "Weekend",
    "multi-day": "Multi-Day",
    expedition: "Expedition",
  };

  const spotsLeft = ride.maxRiders - (ride.activeRegistrations ?? ride.registeredRiders);
  const fillPercentage = ((ride.activeRegistrations ?? ride.registeredRiders) / ride.maxRiders) * 100;

  return (
    <div
      className={`card-interactive group relative overflow-hidden ${
        featured ? "md:col-span-2 md:row-span-2" : ""
      }`}
    >
      {/* Gradient accent */}
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-t2w-accent to-t2w-gold opacity-0 transition-opacity group-hover:opacity-100" />

      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${difficultyColors[ride.difficulty]}`}
              >
                {ride.difficulty}
              </span>
              <span className="rounded-lg border border-t2w-border bg-t2w-surface-light px-2.5 py-1 text-xs font-medium text-t2w-muted">
                {typeLabels[ride.type]}
              </span>
            </div>
            <h3 className="mt-3 font-display text-xl font-bold text-white group-hover:text-t2w-accent transition-colors">
              {ride.title}
            </h3>
            <p className="mt-1 font-mono text-xs text-t2w-muted">
              {ride.rideNumber}
            </p>
          </div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-t2w-accent/10 text-t2w-accent">
            <Route className="h-6 w-6" />
          </div>
        </div>

        {/* Details */}
        <div className="mt-4 space-y-2.5">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Calendar className="h-4 w-4 text-t2w-accent" />
            <span>
              {new Date(ride.startDate).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
              {ride.startDate !== ride.endDate &&
                ` — ${new Date(ride.endDate).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                })}`}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <MapPin className="h-4 w-4 text-t2w-accent" />
            <span>
              {ride.startLocation} → {ride.endLocation}
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <div className="flex items-center gap-1.5">
              <Gauge className="h-4 w-4 text-t2w-accent" />
              <span>{ride.distanceKm} km</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4 text-t2w-accent" />
              <span>
                {ride.registeredRiders}/{ride.maxRiders} riders
              </span>
            </div>
          </div>
        </div>

        {featured && (
          <p className="mt-4 text-sm leading-relaxed text-gray-400">
            {ride.description}
          </p>
        )}

        {/* Capacity Bar */}
        <div className="mt-auto pt-5">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="text-t2w-muted">
              {spotsLeft > 0
                ? `${spotsLeft} spots remaining`
                : "Fully booked"}
            </span>
            <span className="font-mono text-t2w-accent">
              {Math.round(fillPercentage)}%
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-t2w-surface-light">
            <div
              className="h-full rounded-full bg-gradient-to-r from-t2w-accent to-t2w-gold transition-all duration-500"
              style={{ width: `${fillPercentage}%` }}
            />
          </div>
        </div>

        {/* CTA */}
        {ride.status === "upcoming" && spotsLeft > 0 && (
          <Link
            href={`/ride/${ride.id}`}
            className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-t2w-accent/10 py-3 text-sm font-semibold text-t2w-accent transition-all hover:bg-t2w-accent hover:text-white"
          >
            Register Now
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>
    </div>
  );
}

export function UpcomingRides() {
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRides = () => {
      api.rides
        .list()
        .then((data: any) => {
          setRides(data.rides);
        })
        .catch((err) => {
          console.error("Failed to fetch rides:", err);
        })
        .finally(() => {
          setLoading(false);
        });
    };
    fetchRides();
    // Re-fetch when ride data changes (e.g., admin edits rides)
    const handleStorageUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.key === "t2w_custom_rides") fetchRides();
    };
    window.addEventListener("t2w-storage-update", handleStorageUpdate);
    window.addEventListener("storage", (e) => {
      if (e.key === "t2w_custom_rides") fetchRides();
    });
    return () => {
      window.removeEventListener("t2w-storage-update", handleStorageUpdate);
    };
  }, []);

  const upcoming = rides.filter((r) => r.status === "upcoming");
  const recent = rides
    .filter((r) => r.status === "completed")
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
    .slice(0, 5);

  if (loading) {
    return (
      <section className="relative py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <Bike className="mx-auto h-16 w-16 animate-pulse text-t2w-accent" />
              <p className="mt-4 text-t2w-muted">Loading rides...</p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Upcoming */}
        <div className="mb-16">
          <div className="mb-10 flex items-end justify-between">
            <div>
              <h2 className="section-title">Upcoming Rides</h2>
              <p className="mt-3 section-subtitle">
                Your next adventure awaits. Reserve your spot.
              </p>
            </div>
            <Link
              href="/rides"
              className="group hidden items-center gap-2 text-sm font-medium text-t2w-accent transition-colors hover:text-t2w-accent/80 sm:flex"
            >
              View All Rides
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((ride, i) => (
              <RideCard key={ride.id} ride={ride} featured={i === 0} />
            ))}
          </div>
        </div>

        {/* Recent Rides */}
        <div>
          <div className="mb-10">
            <h2 className="section-title">Recent Tales</h2>
            <p className="mt-3 section-subtitle">
              Stories from the road. See where we&apos;ve been.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {recent.map((ride) => (
              <Link
                key={ride.id}
                href={`/ride/${ride.id}`}
                className="card-interactive group"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="rounded-lg bg-green-400/10 px-2.5 py-1 text-xs font-medium text-green-400">
                    Completed
                  </span>
                  <span className="font-mono text-xs text-t2w-accent">
                    {ride.rideNumber}
                  </span>
                </div>
                <h3 className="font-display text-lg font-bold text-white group-hover:text-t2w-accent transition-colors">
                  {ride.title}
                </h3>
                <div className="mt-2 flex items-center gap-2 text-sm text-gray-400">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>{ride.endLocation}</span>
                </div>
                <div className="mt-1 flex items-center gap-2 text-sm text-gray-400">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>
                    {new Date(ride.startDate).toLocaleDateString("en-IN", {
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-1 text-sm text-t2w-muted">
                  <Users className="h-3.5 w-3.5" />
                  <span>{ride.registeredRiders} riders participated</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
