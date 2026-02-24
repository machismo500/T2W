"use client";

import { useState } from "react";
import {
  User,
  Bike,
  MapPin,
  Trophy,
  Gauge,
  Calendar,
  Star,
  Shield,
  Award,
  Gem,
  Zap,
  Crown,
  ChevronRight,
  Settings,
  Camera,
  Plus,
  Edit3,
} from "lucide-react";
import { mockCurrentUser, mockRides } from "@/data/mock";
import { BADGE_TIERS } from "@/data/badges";
import { BadgeTier } from "@/types";

const badgeIcons: Record<string, React.ElementType> = {
  shield: Shield,
  award: Award,
  star: Star,
  gem: Gem,
  zap: Zap,
  crown: Crown,
};

export function DashboardPage() {
  const user = mockCurrentUser;
  const [activeTab, setActiveTab] = useState<"overview" | "rides" | "bikes" | "badges">("overview");

  const completedRides = mockRides.filter((r) => r.status === "completed");
  const upcomingRides = mockRides.filter((r) => r.status === "upcoming");

  // Calculate next badge
  const nextBadge = BADGE_TIERS.find((b) => b.minKm > user.totalKm);
  const prevBadge = [...BADGE_TIERS]
    .reverse()
    .find((b) => b.minKm <= user.totalKm);
  const progress = nextBadge
    ? ((user.totalKm - (prevBadge?.minKm || 0)) /
        (nextBadge.minKm - (prevBadge?.minKm || 0))) *
      100
    : 100;

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Profile Header */}
        <div className="card mb-8 overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-r from-t2w-accent/20 to-t2w-gold/20" />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end">
            {/* Avatar */}
            <div className="relative">
              <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br from-t2w-accent to-red-600 font-display text-3xl font-bold text-white shadow-xl shadow-t2w-accent/20">
                {user.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </div>
              <button className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-t2w-surface border border-t2w-border text-t2w-muted hover:text-white transition-colors">
                <Camera className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="flex-1">
              <h1 className="font-display text-2xl font-bold text-white">
                {user.name}
              </h1>
              <p className="mt-1 text-sm text-t2w-muted">
                Member since{" "}
                {new Date(user.joinDate).toLocaleDateString("en-IN", {
                  month: "long",
                  year: "numeric",
                })}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {user.badges.map((badge) => {
                  const Icon = badgeIcons[badge.icon] || Shield;
                  return (
                    <div
                      key={badge.tier}
                      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1"
                      style={{
                        backgroundColor: `${badge.color}15`,
                        color: badge.color,
                      }}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span className="text-xs font-semibold">
                        {badge.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <button className="btn-secondary flex items-center gap-2 !px-4 !py-2 text-sm">
              <Settings className="h-4 w-4" />
              Edit Profile
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            {
              icon: Bike,
              label: "Rides Completed",
              value: user.ridesCompleted,
              color: "text-t2w-accent",
            },
            {
              icon: Gauge,
              label: "Total KMs",
              value: user.totalKm.toLocaleString(),
              color: "text-t2w-gold",
            },
            {
              icon: Trophy,
              label: "Badges Earned",
              value: user.badges.length,
              color: "text-purple-400",
            },
            {
              icon: Bike,
              label: "Motorcycles",
              value: user.motorcycles.length,
              color: "text-green-400",
            },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="card text-center">
              <Icon className={`mx-auto h-6 w-6 ${color}`} />
              <div className="mt-2 font-display text-2xl font-bold text-white">
                {value}
              </div>
              <div className="text-xs text-t2w-muted">{label}</div>
            </div>
          ))}
        </div>

        {/* Progress to Next Badge */}
        {nextBadge && (
          <div className="card mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg font-bold text-white">
                  Next Badge: {nextBadge.name}
                </h3>
                <p className="mt-1 text-sm text-t2w-muted">
                  {(nextBadge.minKm - user.totalKm).toLocaleString()} km to go
                </p>
              </div>
              <div
                className="flex h-14 w-14 items-center justify-center rounded-xl"
                style={{
                  backgroundColor: `${nextBadge.color}15`,
                }}
              >
                {(() => {
                  const Icon = badgeIcons[nextBadge.icon] || Shield;
                  return (
                    <Icon
                      className="h-7 w-7"
                      style={{ color: nextBadge.color }}
                    />
                  );
                })()}
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-t2w-muted">
                <span>{user.totalKm.toLocaleString()} km</span>
                <span>{nextBadge.minKm.toLocaleString()} km</span>
              </div>
              <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-t2w-surface-light">
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{
                    width: `${progress}%`,
                    background: `linear-gradient(90deg, ${
                      prevBadge?.color || "#e94560"
                    }, ${nextBadge.color})`,
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-8 flex gap-2 border-b border-t2w-border pb-4">
          {(
            [
              { key: "overview", label: "Overview" },
              { key: "rides", label: "My Rides" },
              { key: "bikes", label: "My Motorcycles" },
              { key: "badges", label: "Achievements" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-xl px-5 py-2.5 text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? "bg-t2w-accent text-white"
                  : "text-t2w-muted hover:bg-t2w-surface hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "overview" && (
          <div className="grid gap-8 lg:grid-cols-2">
            {/* Upcoming Rides */}
            <div className="card">
              <h3 className="mb-4 font-display text-lg font-bold text-white">
                Upcoming Rides
              </h3>
              <div className="space-y-3">
                {upcomingRides.slice(0, 3).map((ride) => (
                  <a
                    key={ride.id}
                    href={`/ride/${ride.id}`}
                    className="flex items-center gap-4 rounded-xl bg-t2w-surface-light p-3 transition-colors hover:bg-t2w-border/50"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-400/10">
                      <Calendar className="h-5 w-5 text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        {ride.title}
                      </p>
                      <p className="text-xs text-t2w-muted">
                        {new Date(ride.startDate).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })}{" "}
                        · {ride.distanceKm} km
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-t2w-muted" />
                  </a>
                ))}
              </div>
            </div>

            {/* Recent Rides */}
            <div className="card">
              <h3 className="mb-4 font-display text-lg font-bold text-white">
                Recent Rides
              </h3>
              <div className="space-y-3">
                {completedRides.slice(0, 3).map((ride) => (
                  <a
                    key={ride.id}
                    href={`/ride/${ride.id}`}
                    className="flex items-center gap-4 rounded-xl bg-t2w-surface-light p-3 transition-colors hover:bg-t2w-border/50"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-400/10">
                      <MapPin className="h-5 w-5 text-green-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        {ride.title}
                      </p>
                      <p className="text-xs text-t2w-muted">
                        {new Date(ride.startDate).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })}{" "}
                        · {ride.distanceKm} km
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-t2w-muted" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "rides" && (
          <div>
            <h3 className="mb-6 font-display text-xl font-bold text-white">
              Rides Completed ({user.ridesCompleted})
            </h3>
            <div className="space-y-4">
              {completedRides.map((ride) => (
                <a
                  key={ride.id}
                  href={`/ride/${ride.id}`}
                  className="card-interactive flex items-center gap-6"
                >
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-t2w-accent/20 to-t2w-gold/20">
                    <Gauge className="h-8 w-8 text-t2w-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-display text-lg font-bold text-white">
                      {ride.title}
                    </h4>
                    <div className="mt-1 flex flex-wrap items-center gap-4 text-sm text-t2w-muted">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(ride.startDate).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {ride.endLocation}
                      </span>
                      <span className="flex items-center gap-1">
                        <Gauge className="h-3.5 w-3.5" />
                        {ride.distanceKm} km
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-t2w-muted" />
                </a>
              ))}
            </div>
          </div>
        )}

        {activeTab === "bikes" && (
          <div>
            <div className="mb-6 flex items-center justify-between">
              <h3 className="font-display text-xl font-bold text-white">
                My Motorcycles ({user.motorcycles.length})
              </h3>
              <button className="btn-secondary flex items-center gap-2 !px-4 !py-2 text-sm">
                <Plus className="h-4 w-4" />
                Add Motorcycle
              </button>
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              {user.motorcycles.map((moto) => (
                <div key={moto.id} className="card group relative">
                  <button className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-lg bg-t2w-surface-light text-t2w-muted opacity-0 transition-all group-hover:opacity-100 hover:text-white">
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                  <div className="flex items-start gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-t2w-accent/20 to-red-600/20">
                      <Bike className="h-8 w-8 text-t2w-accent" />
                    </div>
                    <div>
                      <h4 className="font-display text-lg font-bold text-white">
                        {moto.make} {moto.model}
                      </h4>
                      {moto.nickname && (
                        <p className="text-sm text-t2w-accent">
                          &quot;{moto.nickname}&quot;
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-lg bg-t2w-surface-light px-2.5 py-1 text-xs text-t2w-muted">
                          {moto.year}
                        </span>
                        <span className="rounded-lg bg-t2w-surface-light px-2.5 py-1 text-xs text-t2w-muted">
                          {moto.cc}cc
                        </span>
                        <span className="rounded-lg bg-t2w-surface-light px-2.5 py-1 text-xs text-t2w-muted">
                          {moto.color}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "badges" && (
          <div>
            <h3 className="mb-6 font-display text-xl font-bold text-white">
              T2W Achievement System
            </h3>
            <p className="mb-8 text-t2w-muted">
              Earn badges by covering kilometers on T2W rides. The more you
              ride, the higher you climb!
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {BADGE_TIERS.map((badge) => {
                const earned = user.badges.find(
                  (b) => b.tier === badge.tier
                );
                const Icon = badgeIcons[badge.icon] || Shield;
                const isNext =
                  nextBadge?.tier === badge.tier;

                return (
                  <div
                    key={badge.tier}
                    className={`card relative overflow-hidden transition-all ${
                      earned
                        ? "border-opacity-50"
                        : "opacity-60 grayscale"
                    } ${isNext ? "ring-2 ring-offset-2 ring-offset-t2w-dark" : ""}`}
                    style={{
                      borderColor: earned ? badge.color : undefined,
                      ...(isNext
                        ? ({ "--tw-ring-color": badge.color } as React.CSSProperties)
                        : {}),
                    }}
                  >
                    {isNext && (
                      <div
                        className="absolute inset-x-0 top-0 h-1"
                        style={{ backgroundColor: badge.color }}
                      />
                    )}
                    <div className="flex items-start gap-4">
                      <div
                        className="flex h-14 w-14 items-center justify-center rounded-2xl"
                        style={{
                          backgroundColor: `${badge.color}20`,
                        }}
                      >
                        <Icon
                          className="h-7 w-7"
                          style={{ color: badge.color }}
                        />
                      </div>
                      <div>
                        <h4 className="font-display text-lg font-bold text-white">
                          {badge.name}
                        </h4>
                        <p className="mt-1 text-xs text-t2w-muted">
                          {badge.minKm.toLocaleString()} km required
                        </p>
                        {earned?.earnedDate && (
                          <p
                            className="mt-1 text-xs font-medium"
                            style={{ color: badge.color }}
                          >
                            Earned{" "}
                            {new Date(earned.earnedDate).toLocaleDateString(
                              "en-IN",
                              { month: "short", year: "numeric" }
                            )}
                          </p>
                        )}
                        {isNext && (
                          <p className="mt-1 text-xs font-medium text-t2w-gold">
                            {(badge.minKm - user.totalKm).toLocaleString()} km
                            to go
                          </p>
                        )}
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-t2w-muted">
                      {badge.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
