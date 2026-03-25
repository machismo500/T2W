"use client";

import { Trophy, Route, Users, Bike, Calendar, Award } from "lucide-react";
import type { ArenaPeriod, ArenaView } from "./RiderArenaPage";

const periodOptions: { value: ArenaPeriod; label: string }[] = [
  { value: "all", label: "All Time" },
  { value: "1y", label: "Last 1 Year" },
  { value: "6m", label: "Last 6 Months" },
];

interface ArenaHeroProps {
  totalRiders: number;
  totalKm: number;
  totalRides: number;
  period: ArenaPeriod;
  onPeriodChange: (period: ArenaPeriod) => void;
  view: ArenaView;
  onViewChange: (view: ArenaView) => void;
}

export function ArenaHero({ totalRiders, totalKm, totalRides, period, onPeriodChange, view, onViewChange }: ArenaHeroProps) {
  return (
    <section className="relative overflow-hidden border-b border-t2w-border bg-gradient-to-br from-t2w-dark via-t2w-secondary to-t2w-dark pt-28 pb-12 sm:pt-32 sm:pb-16">
      {/* Background glow effects */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/4 top-0 h-64 w-64 rounded-full bg-t2w-accent/10 blur-[120px]" />
        <div className="absolute right-1/4 bottom-0 h-48 w-48 rounded-full bg-t2w-gold/10 blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-t2w-accent/30 bg-t2w-accent/10 px-4 py-1.5 text-xs font-medium tracking-wider text-t2w-accent uppercase">
            <Trophy className="h-3.5 w-3.5" />
            Leaderboard
          </div>

          <h1 className="text-4xl font-bold text-white sm:text-5xl lg:text-6xl">
            Rider{" "}
            <span className="bg-gradient-to-r from-t2w-accent to-t2w-gold bg-clip-text text-transparent">
              Arena
            </span>
          </h1>

          <p className="mx-auto mt-3 max-w-xl text-base text-t2w-muted sm:text-lg">
            Where legends are forged on the open road
          </p>

          {/* View toggle: Leaderboard / Achievements */}
          <div className="mt-5 flex items-center justify-center gap-2">
            <button
              onClick={() => onViewChange("leaderboard")}
              className={`inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-medium transition-all ${
                view === "leaderboard"
                  ? "bg-t2w-accent text-white shadow-lg shadow-t2w-accent/25"
                  : "border border-t2w-border bg-t2w-surface/50 text-t2w-muted hover:border-t2w-accent/40 hover:text-white"
              }`}
            >
              <Trophy className="h-3.5 w-3.5" />
              Leaderboard
            </button>
            <button
              onClick={() => onViewChange("achievements")}
              className={`inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-medium transition-all ${
                view === "achievements"
                  ? "bg-t2w-gold text-white shadow-lg shadow-t2w-gold/25"
                  : "border border-t2w-border bg-t2w-surface/50 text-t2w-muted hover:border-t2w-gold/40 hover:text-white"
              }`}
            >
              <Award className="h-3.5 w-3.5" />
              Achievements
            </button>
          </div>

          {/* Time period selector - only for leaderboard view */}
          {view === "leaderboard" && (
            <div className="mt-4 flex items-center justify-center gap-1.5">
              <Calendar className="mr-1 h-3.5 w-3.5 text-t2w-muted" />
              {periodOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onPeriodChange(opt.value)}
                  className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
                    period === opt.value
                      ? "bg-t2w-accent text-white shadow-lg shadow-t2w-accent/25"
                      : "border border-t2w-border bg-t2w-surface/50 text-t2w-muted hover:border-t2w-accent/40 hover:text-white"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Summary stats - only for leaderboard view */}
        {view === "leaderboard" && (
          <div className="mt-8 grid grid-cols-3 gap-4 sm:mt-10 sm:gap-6 lg:mx-auto lg:max-w-2xl">
            <div className="rounded-xl border border-t2w-border bg-t2w-surface/60 p-4 text-center backdrop-blur">
              <Users className="mx-auto mb-1.5 h-5 w-5 text-t2w-accent" />
              <p className="text-2xl font-bold text-white sm:text-3xl">
                {totalRiders}
              </p>
              <p className="text-xs text-t2w-muted sm:text-sm">Riders</p>
            </div>
            <div className="rounded-xl border border-t2w-border bg-t2w-surface/60 p-4 text-center backdrop-blur">
              <Route className="mx-auto mb-1.5 h-5 w-5 text-t2w-gold" />
              <p className="text-2xl font-bold text-white sm:text-3xl">
                {(totalKm / 1000).toFixed(0)}k
              </p>
              <p className="text-xs text-t2w-muted sm:text-sm">KM Covered</p>
            </div>
            <div className="rounded-xl border border-t2w-border bg-t2w-surface/60 p-4 text-center backdrop-blur">
              <Bike className="mx-auto mb-1.5 h-5 w-5 text-green-400" />
              <p className="text-2xl font-bold text-white sm:text-3xl">
                {totalRides}
              </p>
              <p className="text-xs text-t2w-muted sm:text-sm">Rides Done</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
