"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Calendar,
  MapPin,
  Users,
  ArrowRight,
  Filter,
  Search,
  Gauge,
  Route,
  ChevronDown,
  Bike,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { Ride } from "@/types";

type FilterTab = "all" | "upcoming" | "ongoing" | "completed";

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

const statusColors = {
  upcoming: "text-blue-400 bg-blue-400/10",
  ongoing: "text-yellow-400 bg-yellow-400/10",
  completed: "text-green-400 bg-green-400/10",
  cancelled: "text-red-400 bg-red-400/10",
};

export function RidesPage() {
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

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
    // Re-fetch when ride data changes (e.g., admin edits in another tab)
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

  const filtered = rides
    .filter((ride) => {
      if (activeTab === "upcoming" && ride.status !== "upcoming") return false;
      if (activeTab === "ongoing" && ride.status !== "ongoing") return false;
      if (activeTab === "completed" && ride.status !== "completed") return false;
      if (typeFilter !== "all" && ride.type !== typeFilter) return false;
      if (
        searchQuery &&
        !ride.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !ride.startLocation.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !ride.endLocation.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !ride.rideNumber.toLowerCase().includes(searchQuery.toLowerCase())
      )
        return false;
      return true;
    })
    .sort((a, b) => {
      const statusOrder = { upcoming: 0, ongoing: 1, completed: 2, cancelled: 3 };
      const orderA = statusOrder[a.status] ?? 4;
      const orderB = statusOrder[b.status] ?? 4;
      if (orderA !== orderB) return orderA - orderB;
      // Within the same status group, sort by date
      if (a.status === "completed") {
        return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
      }
      return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    });

  const totalKm = rides
    .filter((r) => r.status === "completed")
    .reduce((acc, r) => acc + r.distanceKm, 0);

  if (loading) {
    return (
      <div className="min-h-screen pt-24 pb-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <Bike className="mx-auto h-16 w-16 animate-pulse text-t2w-accent" />
              <p className="mt-4 text-t2w-muted">Loading rides...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-12">
          <h1 className="font-display text-4xl font-bold text-white md:text-5xl">
            T2W <span className="gradient-text">Tales</span>
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-t2w-muted">
            Every ride is a story. Browse our collection of adventures across
            India and register for your next tale on two wheels.
          </p>

          {/* Stats bar */}
          <div className="mt-8 flex flex-wrap gap-6">
            {[
              { label: "Total Rides", value: rides.length },
              {
                label: "Upcoming",
                value: rides.filter((r) => r.status === "upcoming").length,
              },
              {
                label: "Ongoing",
                value: rides.filter((r) => r.status === "ongoing").length,
              },
              {
                label: "Completed",
                value: rides.filter((r) => r.status === "completed").length,
              },
              {
                label: "Total KMs",
                value: totalKm.toLocaleString(),
              },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="flex items-center gap-3 rounded-xl border border-t2w-border bg-t2w-surface px-5 py-3"
              >
                <span className="font-display text-2xl font-bold text-t2w-accent">
                  {value}
                </span>
                <span className="text-sm text-t2w-muted">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            {(["all", "upcoming", "ongoing", "completed"] as FilterTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`rounded-xl px-5 py-2.5 text-sm font-medium capitalize transition-all ${
                  activeTab === tab
                    ? "bg-t2w-accent text-white shadow-lg shadow-t2w-accent/25"
                    : "bg-t2w-surface text-t2w-muted hover:text-white"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="flex gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-t2w-muted" />
              <input
                type="text"
                placeholder="Search rides..."
                className="input-field !py-2.5 !pl-10 !pr-4 w-64"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="input-field !w-auto !py-2.5 cursor-pointer"
            >
              <option value="all">All Types</option>
              <option value="day">Day Ride</option>
              <option value="weekend">Weekend</option>
              <option value="multi-day">Multi-Day</option>
              <option value="expedition">Expedition</option>
            </select>

            {/* View Toggle */}
            <div className="flex rounded-xl border border-t2w-border bg-t2w-surface">
              <button
                onClick={() => setViewMode("grid")}
                className={`rounded-l-xl px-3 py-2.5 text-sm transition-all ${
                  viewMode === "grid"
                    ? "bg-t2w-accent/20 text-t2w-accent"
                    : "text-t2w-muted hover:text-white"
                }`}
              >
                Grid
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`rounded-r-xl px-3 py-2.5 text-sm transition-all ${
                  viewMode === "table"
                    ? "bg-t2w-accent/20 text-t2w-accent"
                    : "text-t2w-muted hover:text-white"
                }`}
              >
                Table
              </button>
            </div>
          </div>
        </div>

        {/* Results Count */}
        <p className="mb-6 text-sm text-t2w-muted">
          Showing {filtered.length} ride{filtered.length !== 1 ? "s" : ""}
        </p>

        {/* Grid View */}
        {viewMode === "grid" ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((ride) => (
              <Link
                key={ride.id}
                href={`/ride/${ride.id}`}
                className="card-interactive group relative overflow-hidden"
              >
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-t2w-accent to-t2w-gold opacity-0 transition-opacity group-hover:opacity-100" />

                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium capitalize ${statusColors[ride.status]}`}
                    >
                      {ride.status === "ongoing" ? "Ongoing Ride" : ride.status}
                    </span>
                    <span
                      className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${difficultyColors[ride.difficulty]}`}
                    >
                      {ride.difficulty}
                    </span>
                  </div>
                  <span className="rounded-lg bg-t2w-surface-light px-2 py-1 text-xs text-t2w-muted">
                    {typeLabels[ride.type]}
                  </span>
                </div>

                <h3 className="mt-4 font-display text-xl font-bold text-white group-hover:text-t2w-accent transition-colors">
                  <span className="text-t2w-accent">{ride.rideNumber}</span>{" "}
                  {ride.title}
                </h3>

                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Calendar className="h-4 w-4 text-t2w-accent/70" />
                    <span>
                      {new Date(ride.startDate).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <MapPin className="h-4 w-4 text-t2w-accent/70" />
                    <span className="truncate">
                      {ride.startLocation} → {ride.endLocation}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 text-sm text-gray-400">
                      <Gauge className="h-4 w-4 text-t2w-accent/70" />
                      <span>{ride.distanceKm} km</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-gray-400">
                      <Users className="h-4 w-4 text-t2w-accent/70" />
                      <span>
                        {ride.registeredRiders}/{ride.maxRiders}
                      </span>
                    </div>
                  </div>
                </div>

                <p className="mt-4 line-clamp-2 text-sm text-t2w-muted">
                  {ride.description}
                </p>

                {/* Highlights */}
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {ride.highlights.slice(0, 3).map((h) => (
                    <span
                      key={h}
                      className="rounded-md bg-t2w-surface-light px-2 py-0.5 text-xs text-t2w-muted"
                    >
                      {h}
                    </span>
                  ))}
                </div>

                {ride.status === "upcoming" && (
                  <div className="mt-5 flex items-center justify-between border-t border-t2w-border pt-4">
                    <span className="text-sm font-semibold text-t2w-gold">
                      ₹{ride.fee.toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1 text-sm font-medium text-t2w-accent">
                      Register <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>
                )}
              </Link>
            ))}
          </div>
        ) : (
          /* Table View */
          <div className="overflow-x-auto rounded-2xl border border-t2w-border">
            <table className="w-full">
              <thead>
                <tr className="border-b border-t2w-border bg-t2w-surface">
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-t2w-muted">
                    Ride
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-t2w-muted">
                    Date
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-t2w-muted">
                    Route
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-t2w-muted">
                    Distance
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-t2w-muted">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-t2w-muted">
                    Riders
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-t2w-muted">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-t2w-border">
                {filtered.map((ride) => (
                  <tr
                    key={ride.id}
                    className="bg-t2w-dark transition-colors hover:bg-t2w-surface/50"
                  >
                    <td className="px-6 py-4">
                      <div>
                        <Link
                          href={`/ride/${ride.id}`}
                          className="font-semibold text-white hover:text-t2w-accent transition-colors"
                        >
                          {ride.title}
                        </Link>
                        <p className="mt-0.5 font-mono text-xs text-t2w-muted">
                          {ride.rideNumber}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-400">
                      {new Date(ride.startDate).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-400">
                      {ride.startLocation} → {ride.endLocation}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-white">
                      {ride.distanceKm} km
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-lg px-2.5 py-1 text-xs font-medium capitalize ${statusColors[ride.status]}`}
                      >
                        {ride.status === "ongoing" ? "Ongoing Ride" : ride.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-400">
                      {ride.registeredRiders}/{ride.maxRiders}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/ride/${ride.id}`}
                        className="text-sm font-medium text-t2w-accent hover:text-t2w-accent/80 transition-colors"
                      >
                        View Details →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filtered.length === 0 && (
          <div className="py-20 text-center">
            <Bike className="mx-auto h-16 w-16 text-t2w-border" />
            <h3 className="mt-4 font-display text-xl font-bold text-white">
              No rides found
            </h3>
            <p className="mt-2 text-t2w-muted">
              Try adjusting your filters or search query.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
