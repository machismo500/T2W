"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Search,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  List,
  Trophy,
  Shield,
  Award,
  Star,
  Gem,
  Zap,
  Crown,
  Info,
} from "lucide-react";
import type { ArenaRider, SortField, ArenaWeights } from "./types";
import { DEFAULT_ARENA_WEIGHTS } from "./types";
import { ArenaRiderCard } from "./ArenaRiderCard";
import type { Badge } from "@/types";

const badgeIcons: Record<string, React.ElementType> = {
  shield: Shield,
  award: Award,
  star: Star,
  gem: Gem,
  zap: Zap,
  crown: Crown,
};

const sortLabels: Record<SortField, string> = {
  arenaScore: "Arena Score",
  totalKm: "Total KM",
  ridesCompleted: "Rides",
  ridesOrganized: "Organized",
  sweepsDone: "Sweeps",
  pilotsDone: "Pilots",
  totalPoints: "Points",
  joinDate: "Join Date",
};

const roleLabels: Record<string, string> = {
  superadmin: "Super Admin",
  core_member: "Core Member",
  t2w_rider: "T2W Rider",
  rider: "Rider",
};

const roleBadgeColors: Record<string, string> = {
  superadmin: "text-purple-300",
  core_member: "text-t2w-accent",
  t2w_rider: "text-blue-300",
  rider: "text-gray-400",
};

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

interface ArenaLeaderboardProps {
  riders: ArenaRider[];
  currentUserId?: string | null;
  badgeTiers: Badge[];
  weights?: ArenaWeights;
  canLinkProfiles?: boolean;
}

export function ArenaLeaderboard({
  riders,
  currentUserId,
  badgeTiers,
  weights = DEFAULT_ARENA_WEIGHTS,
  canLinkProfiles = false,
}: ArenaLeaderboardProps) {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("arenaScore");
  const [sortAsc, setSortAsc] = useState(false);
  const [roleFilter, setRoleFilter] = useState("all");
  const [badgeFilter, setBadgeFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [showScoring, setShowScoring] = useState(false);

  // Filter
  let filtered = riders;
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter((r) => r.name.toLowerCase().includes(q));
  }
  if (roleFilter !== "all") {
    filtered = filtered.filter((r) => r.userRole === roleFilter);
  }
  if (badgeFilter !== "all") {
    filtered = filtered.filter((r) => r.badgeTier === badgeFilter);
  }

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    let va: number | string;
    let vb: number | string;
    if (sortField === "joinDate") {
      va = a.joinDate;
      vb = b.joinDate;
    } else {
      va = a[sortField];
      vb = b[sortField];
    }
    if (va < vb) return sortAsc ? -1 : 1;
    if (va > vb) return sortAsc ? 1 : -1;
    return 0;
  });

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const SortHeader = ({
    field,
    label,
    className = "",
  }: {
    field: SortField;
    label: string;
    className?: string;
  }) => (
    <th
      onClick={() => handleSort(field)}
      className={`cursor-pointer px-3 py-3 text-xs font-medium uppercase tracking-wider text-t2w-muted transition-colors hover:text-white select-none ${className}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortField === field &&
          (sortAsc ? (
            <ChevronUp className="h-3 w-3 text-t2w-accent" />
          ) : (
            <ChevronDown className="h-3 w-3 text-t2w-accent" />
          ))}
      </span>
    </th>
  );

  // Stats for card bar proportions
  const maxKm = Math.max(...riders.map((r) => r.totalKm), 1);
  const maxRides = Math.max(...riders.map((r) => r.ridesCompleted), 1);

  // Badge distribution for legend
  const badgeCounts: Record<string, number> = {};
  riders.forEach((r) => {
    const tier = r.badgeTier || "None";
    badgeCounts[tier] = (badgeCounts[tier] || 0) + 1;
  });

  return (
    <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
      {/* Scoring info panel */}
      <div className="mb-6">
        <button
          onClick={() => setShowScoring(!showScoring)}
          className="inline-flex items-center gap-2 rounded-lg border border-t2w-border bg-t2w-surface/60 px-4 py-2 text-sm text-t2w-muted transition-colors hover:border-t2w-accent/30 hover:text-white"
        >
          <Info className="h-4 w-4" />
          How Arena Score Works
          {showScoring ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>

        {showScoring && (
          <div className="mt-3 rounded-xl border border-t2w-border bg-t2w-surface/80 p-5">
            <h3 className="mb-3 text-sm font-semibold text-white">
              Arena Score Formula
            </h3>
            <div className="mb-1 text-xs font-medium text-t2w-muted">Points Per Ride</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-lg bg-t2w-dark/60 p-3 text-center">
                <p className="text-lg font-bold text-blue-400">{weights.ptsDay}</p>
                <p className="text-xs text-t2w-muted">Day Ride</p>
              </div>
              <div className="rounded-lg bg-t2w-dark/60 p-3 text-center">
                <p className="text-lg font-bold text-blue-400">{weights.ptsWeekend}</p>
                <p className="text-xs text-t2w-muted">Weekend</p>
              </div>
              <div className="rounded-lg bg-t2w-dark/60 p-3 text-center">
                <p className="text-lg font-bold text-blue-400">{weights.ptsMultiDay}</p>
                <p className="text-xs text-t2w-muted">Multi-Day</p>
              </div>
              <div className="rounded-lg bg-t2w-dark/60 p-3 text-center">
                <p className="text-lg font-bold text-blue-400">{weights.ptsExpedition}</p>
                <p className="text-xs text-t2w-muted">Expedition</p>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-t2w-dark/60 p-3 text-center">
                <p className="text-lg font-bold text-t2w-accent">{weights.ridesOrganized}</p>
                <p className="text-xs text-t2w-muted">pts / Organized</p>
              </div>
              <div className="rounded-lg bg-t2w-dark/60 p-3 text-center">
                <p className="text-lg font-bold text-orange-400">{weights.sweepsDone}</p>
                <p className="text-xs text-t2w-muted">pts / Sweep</p>
              </div>
              <div className="rounded-lg bg-t2w-dark/60 p-3 text-center">
                <p className="text-lg font-bold text-green-400">{weights.totalKm}</p>
                <p className="text-xs text-t2w-muted">pts / KM</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-t2w-muted">
              Arena Score = (Day×{weights.ptsDay}) + (Weekend×{weights.ptsWeekend}) + (Multi-day×{weights.ptsMultiDay}) + (Expedition×{weights.ptsExpedition}) +
              (Organised×{weights.ridesOrganized}) + (Sweeps×{weights.sweepsDone}) + (KM×{weights.totalKm})
            </p>
          </div>
        )}
      </div>

      {/* Search + Filters + View toggle */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-t2w-muted" />
          <input
            type="text"
            placeholder="Search riders..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-t2w-border bg-t2w-surface py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-t2w-muted focus:border-t2w-accent/50 focus:outline-none"
          />
        </div>

        {/* Role filter */}
        <div className="relative">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="appearance-none rounded-xl border border-t2w-border bg-t2w-surface py-2.5 pl-4 pr-10 text-sm text-white focus:border-t2w-accent/50 focus:outline-none"
          >
            <option value="all">All Roles</option>
            <option value="superadmin">Super Admin</option>
            <option value="core_member">Core Member</option>
            <option value="t2w_rider">T2W Rider</option>
            <option value="rider">Rider</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-t2w-muted" />
        </div>

        {/* Badge filter */}
        <div className="relative">
          <select
            value={badgeFilter}
            onChange={(e) => setBadgeFilter(e.target.value)}
            className="appearance-none rounded-xl border border-t2w-border bg-t2w-surface py-2.5 pl-4 pr-10 text-sm text-white focus:border-t2w-accent/50 focus:outline-none"
          >
            <option value="all">All Badges</option>
            {badgeTiers.map((b) => (
              <option key={b.tier} value={b.tier}>
                {b.name}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-t2w-muted" />
        </div>

        {/* Sort (mobile-friendly dropdown) */}
        <div className="relative sm:hidden">
          <select
            value={sortField}
            onChange={(e) => {
              setSortField(e.target.value as SortField);
              setSortAsc(false);
            }}
            className="appearance-none rounded-xl border border-t2w-border bg-t2w-surface py-2.5 pl-4 pr-10 text-sm text-white focus:border-t2w-accent/50 focus:outline-none"
          >
            {Object.entries(sortLabels).map(([k, v]) => (
              <option key={k} value={k}>
                Sort: {v}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-t2w-muted" />
        </div>

        {/* View toggle */}
        <div className="flex rounded-xl border border-t2w-border bg-t2w-surface">
          <button
            onClick={() => setViewMode("table")}
            className={`rounded-l-xl p-2.5 transition-colors ${viewMode === "table" ? "bg-t2w-accent/20 text-t2w-accent" : "text-t2w-muted hover:text-white"}`}
          >
            <List className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode("grid")}
            className={`rounded-r-xl p-2.5 transition-colors ${viewMode === "grid" ? "bg-t2w-accent/20 text-t2w-accent" : "text-t2w-muted hover:text-white"}`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Badge distribution */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {badgeTiers.map((b) => {
          const BadgeIcon = badgeIcons[b.icon];
          const count = badgeCounts[b.tier] || 0;
          return (
            <button
              key={b.tier}
              onClick={() =>
                setBadgeFilter(badgeFilter === b.tier ? "all" : b.tier)
              }
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                badgeFilter === b.tier
                  ? "border-white/30 bg-white/10 text-white"
                  : "border-t2w-border bg-t2w-surface/50 text-t2w-muted hover:border-white/20"
              }`}
            >
              {BadgeIcon && (
                <BadgeIcon className="h-3 w-3" style={{ color: b.color }} />
              )}
              {b.tier} ({count})
            </button>
          );
        })}
        <span className="rounded-full border border-t2w-border bg-t2w-surface/50 px-3 py-1 text-xs text-t2w-muted">
          No Badge ({badgeCounts["None"] || 0})
        </span>
      </div>

      {/* Results count */}
      <p className="mb-4 text-sm text-t2w-muted">
        Showing {sorted.length} of {riders.length} riders
      </p>

      {/* Table View */}
      {viewMode === "table" && (
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
                <th className="hidden px-3 py-3 text-xs font-medium uppercase tracking-wider text-t2w-muted sm:table-cell">
                  Role
                </th>
                <th className="hidden px-3 py-3 text-xs font-medium uppercase tracking-wider text-t2w-muted md:table-cell">
                  Badge
                </th>
                <SortHeader field="arenaScore" label="Score" />
                <SortHeader
                  field="ridesCompleted"
                  label="Rides"
                  className="hidden sm:table-cell"
                />
                <SortHeader
                  field="totalKm"
                  label="KM"
                  className="hidden md:table-cell"
                />
                <SortHeader
                  field="ridesOrganized"
                  label="Org"
                  className="hidden lg:table-cell"
                />
                <SortHeader
                  field="sweepsDone"
                  label="Sweeps"
                  className="hidden lg:table-cell"
                />
                <SortHeader
                  field="pilotsDone"
                  label="Pilots"
                  className="hidden lg:table-cell"
                />
                <SortHeader
                  field="totalPoints"
                  label="Pts"
                  className="hidden xl:table-cell"
                />
              </tr>
            </thead>
            <tbody className="divide-y divide-t2w-border/50">
              {sorted.map((rider, idx) => {
                const isMe = currentUserId === rider.id;
                const BadgeIcon = rider.badgeIcon
                  ? badgeIcons[rider.badgeIcon]
                  : null;
                const rankColor =
                  idx === 0
                    ? "text-yellow-400 font-bold"
                    : idx === 1
                      ? "text-gray-300 font-bold"
                      : idx === 2
                        ? "text-orange-400 font-bold"
                        : "text-t2w-muted";

                return (
                  <tr
                    key={rider.id}
                    className={`transition-colors hover:bg-white/[0.03] ${
                      isMe ? "bg-t2w-gold/[0.05]" : ""
                    }`}
                  >
                    <td className={`px-3 py-3 text-sm ${rankColor}`}>
                      {idx + 1}
                    </td>
                    <td className="px-3 py-3">
                      {canLinkProfiles ? (
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
                          <span className="text-sm font-medium text-white">
                            {rider.name}
                            {isMe && (
                              <span className="ml-1.5 text-[10px] text-t2w-gold">
                                (You)
                              </span>
                            )}
                          </span>
                        </Link>
                      ) : (
                        <div className="flex items-center gap-2.5">
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
                          <span className="text-sm font-medium text-white">
                            {rider.name}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="hidden px-3 py-3 sm:table-cell">
                      <span
                        className={`text-xs font-medium ${roleBadgeColors[rider.userRole || "rider"] || "text-gray-400"}`}
                      >
                        {roleLabels[rider.userRole || "rider"] || "Rider"}
                      </span>
                    </td>
                    <td className="hidden px-3 py-3 md:table-cell">
                      {BadgeIcon && rider.badgeTier ? (
                        <span className="inline-flex items-center gap-1">
                          <BadgeIcon
                            className="h-3.5 w-3.5"
                            style={{ color: rider.badgeColor || "#6b7280" }}
                          />
                          <span
                            className="text-xs font-medium"
                            style={{ color: rider.badgeColor || "#6b7280" }}
                          >
                            {rider.badgeTier}
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs text-t2w-muted">-</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center gap-1 text-sm font-semibold text-t2w-gold">
                        <Trophy className="h-3 w-3" />
                        {rider.arenaScore.toFixed(1)}
                      </span>
                    </td>
                    <td className="hidden px-3 py-3 text-sm text-white sm:table-cell">
                      {rider.ridesCompleted}
                    </td>
                    <td className="hidden px-3 py-3 text-sm text-white md:table-cell">
                      {rider.totalKm.toLocaleString()}
                    </td>
                    <td className="hidden px-3 py-3 text-sm text-white lg:table-cell">
                      {rider.ridesOrganized}
                    </td>
                    <td className="hidden px-3 py-3 text-sm text-white lg:table-cell">
                      {rider.sweepsDone}
                    </td>
                    <td className="hidden px-3 py-3 text-sm text-white lg:table-cell">
                      {rider.pilotsDone}
                    </td>
                    <td className="hidden px-3 py-3 text-sm text-white xl:table-cell">
                      {rider.totalPoints}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {sorted.length === 0 && (
            <div className="py-12 text-center text-sm text-t2w-muted">
              No riders match your filters
            </div>
          )}
        </div>
      )}

      {/* Grid View */}
      {viewMode === "grid" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sorted.map((rider, idx) => (
            <ArenaRiderCard
              key={rider.id}
              rider={rider}
              rank={idx + 1}
              maxKm={maxKm}
              maxRides={maxRides}
              isCurrentUser={currentUserId === rider.id}
              canLinkProfiles={canLinkProfiles}
            />
          ))}
          {sorted.length === 0 && (
            <div className="col-span-full py-12 text-center text-sm text-t2w-muted">
              No riders match your filters
            </div>
          )}
        </div>
      )}
    </section>
  );
}
