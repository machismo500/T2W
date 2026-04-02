"use client";

import Link from "next/link";
import {
  Shield,
  Award,
  Star,
  Gem,
  Zap,
  Crown,
  Trophy,
  Bike,
  Route,
  Flag,
} from "lucide-react";
import type { ArenaRider } from "./types";

const badgeIcons: Record<string, React.ElementType> = {
  shield: Shield,
  award: Award,
  star: Star,
  gem: Gem,
  zap: Zap,
  crown: Crown,
};

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const roleLabels: Record<string, string> = {
  superadmin: "Super Admin",
  core_member: "Core Member",
  t2w_rider: "T2W Rider",
  rider: "Rider",
};

const roleBadgeColors: Record<string, string> = {
  superadmin: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  core_member: "bg-t2w-accent/20 text-t2w-accent border-t2w-accent/30",
  t2w_rider: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  rider: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

interface ArenaRiderCardProps {
  rider: ArenaRider;
  rank: number;
  maxKm: number;
  maxRides: number;
  isCurrentUser: boolean;
  canLinkProfiles?: boolean;
}

export function ArenaRiderCard({
  rider,
  rank,
  maxKm,
  maxRides,
  isCurrentUser,
  canLinkProfiles = false,
}: ArenaRiderCardProps) {
  const BadgeIcon = rider.badgeIcon ? badgeIcons[rider.badgeIcon] : null;

  const rankColor =
    rank === 1
      ? "text-yellow-400"
      : rank === 2
        ? "text-gray-300"
        : rank === 3
          ? "text-orange-400"
          : "text-t2w-muted";

  const cardClassName = `group relative block rounded-2xl border bg-t2w-surface/80 p-5 transition-all duration-300 ${canLinkProfiles ? "hover:-translate-y-1 hover:shadow-lg hover:shadow-t2w-accent/5" : ""} ${
    isCurrentUser
      ? "border-t2w-gold/40 shadow-[0_0_20px_rgba(245,166,35,0.1)]"
      : `border-t2w-border ${canLinkProfiles ? "hover:border-t2w-accent/30" : ""}`
  }`;

  const cardContent = (
    <>
      {/* Rank */}
      <span
        className={`absolute right-4 top-4 text-2xl font-black opacity-25 ${rankColor}`}
      >
        #{rank}
      </span>

      {/* Avatar + name row */}
      <div className="mb-4 flex items-center gap-3">
        <div
          className="h-12 w-12 shrink-0 overflow-hidden rounded-full"
          style={{
            boxShadow: rider.badgeColor
              ? `0 0 0 2px ${rider.badgeColor}66, 0 0 12px ${rider.badgeColor}33`
              : "0 0 0 2px #2a2a2a",
          }}
        >
          {rider.avatarUrl ? (
            <img
              src={rider.avatarUrl}
              alt={rider.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-t2w-surface-light text-sm font-bold text-t2w-muted">
              {getInitials(rider.name)}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className={`truncate text-sm font-semibold text-white ${canLinkProfiles ? "group-hover:text-t2w-accent transition-colors" : ""}`}>
            {rider.name}
          </p>
          {rider.userRole && (
            <span
              className={`mt-0.5 inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium ${roleBadgeColors[rider.userRole] || roleBadgeColors.rider}`}
            >
              {roleLabels[rider.userRole] || rider.userRole}
            </span>
          )}
        </div>
      </div>

      {/* Arena score */}
      <div className="mb-4 flex items-center gap-2 rounded-lg bg-t2w-dark/60 px-3 py-2">
        <Trophy className="h-4 w-4 text-t2w-gold" />
        <span className="text-lg font-bold text-white">
          {rider.arenaScore.toFixed(1)}
        </span>
        <span className="text-xs text-t2w-muted">Arena Score</span>
        {BadgeIcon && (
          <span className="ml-auto flex items-center gap-1">
            <BadgeIcon
              className="h-4 w-4"
              style={{ color: rider.badgeColor || "#6b7280" }}
            />
            <span
              className="text-[10px] font-medium"
              style={{ color: rider.badgeColor || "#6b7280" }}
            >
              {rider.badgeTier}
            </span>
          </span>
        )}
      </div>

      {/* Stat bars */}
      <div className="space-y-2.5">
        <StatBar
          icon={<Bike className="h-3.5 w-3.5 text-blue-400" />}
          label="Rides"
          value={rider.ridesCompleted}
          max={maxRides}
          color="bg-blue-400"
        />
        <StatBar
          icon={<Route className="h-3.5 w-3.5 text-green-400" />}
          label="KM"
          value={rider.totalKm}
          max={maxKm}
          color="bg-green-400"
          format={(v) => v.toLocaleString()}
        />
        <StatBar
          icon={<Flag className="h-3.5 w-3.5 text-t2w-accent" />}
          label="Organized"
          value={rider.ridesOrganized}
          max={Math.max(maxRides, 1)}
          color="bg-t2w-accent"
        />
      </div>
    </>
  );

  return (
    <>
      {canLinkProfiles ? (
        <Link href={`/rider/${rider.id}`} className={cardClassName}>
          {cardContent}
        </Link>
      ) : (
        <div className={cardClassName}>
          {cardContent}
        </div>
      )}
    </>
  );

}

function StatBar({
  icon,
  label,
  value,
  max,
  color,
  format,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  max: number;
  color: string;
  format?: (v: number) => string;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-2">
      {icon}
      <span className="w-16 text-xs text-t2w-muted">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-t2w-dark">
        <div
          className={`h-full rounded-full ${color} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-12 text-right text-xs font-medium text-white">
        {format ? format(value) : value}
      </span>
    </div>
  );
}
