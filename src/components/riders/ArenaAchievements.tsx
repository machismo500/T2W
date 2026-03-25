"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Loader2,
  Award,
  Star,
  Bike,
  Target,
  TrendingUp,
  CheckCircle,
  Calendar,
} from "lucide-react";
import { api } from "@/lib/api-client";

type AchievementRider = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  userRole?: string | null;
  ridesCompletedInPeriod: number;
  ridesOrganizedInPeriod: number;
  sweepsDoneInPeriod: number;
  participationPts: number;
  organizePts: number;
  sweepPts: number;
  totalPts: number;
  highlighted: boolean;
};

type AchievementData = {
  configured: boolean;
  periodStart: string;
  periodEnd: string;
  pointsPerParticipation: number;
  pointsPerOrganize: number;
  pointsPerSweep: number;
  thresholdPercent: number;
  totalRidesInPeriod: number;
  maxPossible: number;
  threshold: number;
  rides: Array<{ id: string; rideNumber: string; title: string; startDate: string }>;
  riders: AchievementRider[];
};

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatPeriodDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

export function ArenaAchievements() {
  const [data, setData] = useState<AchievementData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.achievements
      .get()
      .then((res: AchievementData | null) => {
        setData(res);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-t2w-accent" />
      </div>
    );
  }

  if (!data || !data.configured) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
        <Award className="mx-auto h-16 w-16 text-t2w-border" />
        <h3 className="mt-4 text-xl font-semibold text-white">
          No Achievement Period Configured
        </h3>
        <p className="mt-2 text-t2w-muted">
          The admin has not yet configured an achievement evaluation period. Check back later!
        </p>
      </div>
    );
  }

  const highlightedCount = data.riders.filter((r) => r.highlighted).length;

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Period Header */}
      <div className="mb-8 text-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-t2w-gold/30 bg-t2w-gold/10 px-4 py-1.5 text-xs font-medium tracking-wider text-t2w-gold uppercase">
          <Calendar className="h-3.5 w-3.5" />
          Achievement Period
        </div>
        <h2 className="text-2xl font-bold text-white sm:text-3xl">
          {formatPeriodDate(data.periodStart)} &ndash; {formatPeriodDate(data.periodEnd)}
        </h2>
        <p className="mt-2 text-sm text-t2w-muted">
          Riders meeting {data.thresholdPercent}% of {data.thresholdBase ?? 60} base points (12 rides × {data.pointsPerParticipation} pts) are highlighted
        </p>
      </div>

      {/* Summary Cards */}
      <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:mx-auto lg:max-w-3xl">
        <div className="rounded-xl border border-t2w-border bg-t2w-surface/60 p-4 text-center backdrop-blur">
          <Bike className="mx-auto mb-1.5 h-5 w-5 text-t2w-accent" />
          <p className="text-2xl font-bold text-white">{data.totalRidesInPeriod}</p>
          <p className="text-xs text-t2w-muted">Total Rides</p>
        </div>
        <div className="rounded-xl border border-t2w-border bg-t2w-surface/60 p-4 text-center backdrop-blur">
          <Target className="mx-auto mb-1.5 h-5 w-5 text-t2w-gold" />
          <p className="text-2xl font-bold text-white">{data.maxPossible}</p>
          <p className="text-xs text-t2w-muted">Max Points</p>
        </div>
        <div className="rounded-xl border border-t2w-border bg-t2w-surface/60 p-4 text-center backdrop-blur">
          <TrendingUp className="mx-auto mb-1.5 h-5 w-5 text-orange-400" />
          <p className="text-2xl font-bold text-white">{data.threshold}</p>
          <p className="text-xs text-t2w-muted">{data.thresholdPercent}% Threshold</p>
        </div>
        <div className="rounded-xl border border-t2w-border bg-t2w-surface/60 p-4 text-center backdrop-blur">
          <Star className="mx-auto mb-1.5 h-5 w-5 text-green-400" />
          <p className="text-2xl font-bold text-white">{highlightedCount}</p>
          <p className="text-xs text-t2w-muted">Achievers</p>
        </div>
      </div>

      {/* Points breakdown info */}
      <div className="mb-6 rounded-xl border border-t2w-border bg-t2w-surface/80 p-4 lg:mx-auto lg:max-w-3xl">
        <p className="text-xs text-t2w-muted">
          <strong className="text-white">Points per ride:</strong>{" "}
          Participation = {data.pointsPerParticipation} pts,{" "}
          Organise = {data.pointsPerOrganize} pts,{" "}
          Sweep = {data.pointsPerSweep} pts{" "}
          (Max per ride = {data.pointsPerParticipation + data.pointsPerOrganize + data.pointsPerSweep} pts)
        </p>
      </div>

      {/* Rider List */}
      <div className="overflow-x-auto rounded-2xl border border-t2w-border bg-t2w-surface/60">
        <table className="w-full text-left">
          <thead className="border-b border-t2w-border bg-t2w-dark/40">
            <tr>
              <th className="px-3 py-3 text-xs font-medium uppercase tracking-wider text-t2w-muted w-12">
                #
              </th>
              <th className="px-3 py-3 text-xs font-medium uppercase tracking-wider text-t2w-muted">
                Rider
              </th>
              <th className="hidden px-3 py-3 text-xs font-medium uppercase tracking-wider text-t2w-muted sm:table-cell text-center">
                Rides
              </th>
              <th className="hidden px-3 py-3 text-xs font-medium uppercase tracking-wider text-t2w-muted md:table-cell text-center">
                Organised
              </th>
              <th className="hidden px-3 py-3 text-xs font-medium uppercase tracking-wider text-t2w-muted md:table-cell text-center">
                Sweeps
              </th>
              <th className="px-3 py-3 text-xs font-medium uppercase tracking-wider text-t2w-muted text-center">
                Ride Pts
              </th>
              <th className="hidden px-3 py-3 text-xs font-medium uppercase tracking-wider text-t2w-muted sm:table-cell text-center">
                Org Pts
              </th>
              <th className="hidden px-3 py-3 text-xs font-medium uppercase tracking-wider text-t2w-muted sm:table-cell text-center">
                Sweep Pts
              </th>
              <th className="px-3 py-3 text-xs font-medium uppercase tracking-wider text-t2w-muted text-center">
                Total
              </th>
              <th className="px-3 py-3 text-xs font-medium uppercase tracking-wider text-t2w-muted text-center w-16">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-t2w-border/50">
            {data.riders.map((rider, idx) => (
              <tr
                key={rider.id}
                className={`transition-colors ${
                  rider.highlighted
                    ? "bg-t2w-gold/[0.08] hover:bg-t2w-gold/[0.12]"
                    : "hover:bg-white/[0.03]"
                }`}
              >
                <td className={`px-3 py-3 text-sm font-medium ${rider.highlighted ? "text-t2w-gold" : "text-t2w-muted"}`}>
                  {idx + 1}
                </td>
                <td className="px-3 py-3">
                  <Link
                    href={`/rider/${rider.id}`}
                    className="flex items-center gap-2.5 hover:opacity-80"
                  >
                    <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-t2w-surface-light">
                      {rider.avatarUrl ? (
                        <img
                          src={rider.avatarUrl}
                          alt={rider.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs font-bold text-t2w-muted">
                          {getInitials(rider.name)}
                        </div>
                      )}
                    </div>
                    <span className={`text-sm font-medium ${rider.highlighted ? "text-t2w-gold" : "text-white"}`}>
                      {rider.name}
                    </span>
                  </Link>
                </td>
                <td className="hidden px-3 py-3 text-sm text-white text-center sm:table-cell">
                  {rider.ridesCompletedInPeriod}
                </td>
                <td className="hidden px-3 py-3 text-sm text-white text-center md:table-cell">
                  {rider.ridesOrganizedInPeriod}
                </td>
                <td className="hidden px-3 py-3 text-sm text-white text-center md:table-cell">
                  {rider.sweepsDoneInPeriod}
                </td>
                <td className="px-3 py-3 text-sm text-blue-400 text-center">
                  {rider.participationPts}
                </td>
                <td className="hidden px-3 py-3 text-sm text-t2w-accent text-center sm:table-cell">
                  {rider.organizePts}
                </td>
                <td className="hidden px-3 py-3 text-sm text-orange-400 text-center sm:table-cell">
                  {rider.sweepPts}
                </td>
                <td className="px-3 py-3 text-center">
                  <span className={`text-sm font-semibold ${rider.highlighted ? "text-t2w-gold" : "text-white"}`}>
                    {rider.totalPts}
                  </span>
                </td>
                <td className="px-3 py-3 text-center">
                  {rider.highlighted ? (
                    <CheckCircle className="mx-auto h-5 w-5 text-green-400" />
                  ) : (
                    <span className="text-xs text-t2w-muted">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.riders.length === 0 && (
          <div className="py-12 text-center text-sm text-t2w-muted">
            No riders have participation data in this period
          </div>
        )}
      </div>

      {/* Rides in period */}
      <div className="mt-8">
        <h3 className="mb-4 text-lg font-semibold text-white">
          Rides in This Period ({data.rides.length})
        </h3>
        <div className="flex flex-wrap gap-2">
          {data.rides.map((ride) => (
            <span
              key={ride.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-t2w-border bg-t2w-surface/50 px-3 py-1 text-xs text-t2w-muted"
            >
              <Bike className="h-3 w-3" />
              {ride.rideNumber} - {ride.title}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
