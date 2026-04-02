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

const podiumOrder = [1, 0, 2] as const; // silver-left, gold-center, bronze-right

const podiumStyles = [
  {
    // Gold / 1st
    ring: "ring-2 ring-yellow-400/60",
    glow: "shadow-[0_0_40px_rgba(245,166,35,0.3)]",
    bg: "bg-gradient-to-b from-yellow-400/20 to-transparent",
    label: "text-yellow-400",
    height: "h-28 sm:h-36",
    avatar: "h-20 w-20 sm:h-24 sm:w-24",
    badge: "bg-yellow-400/20 text-yellow-400 border-yellow-400/40",
    rankSize: "text-4xl sm:text-5xl",
  },
  {
    // Silver / 2nd
    ring: "ring-2 ring-gray-300/50",
    glow: "",
    bg: "bg-gradient-to-b from-gray-400/10 to-transparent",
    label: "text-gray-300",
    height: "h-20 sm:h-24",
    avatar: "h-16 w-16 sm:h-20 sm:w-20",
    badge: "bg-gray-400/20 text-gray-300 border-gray-400/30",
    rankSize: "text-3xl sm:text-4xl",
  },
  {
    // Bronze / 3rd
    ring: "ring-2 ring-orange-400/50",
    glow: "",
    bg: "bg-gradient-to-b from-orange-400/10 to-transparent",
    label: "text-orange-300",
    height: "h-16 sm:h-20",
    avatar: "h-16 w-16 sm:h-20 sm:w-20",
    badge: "bg-orange-400/20 text-orange-300 border-orange-400/30",
    rankSize: "text-3xl sm:text-4xl",
  },
];

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function ArenaPodium({ riders, canLinkProfiles = false }: { riders: ArenaRider[]; canLinkProfiles?: boolean }) {
  const top3 = riders.slice(0, 3);
  if (top3.length === 0) return null;

  return (
    <section className="mx-auto max-w-4xl px-4 py-10 sm:py-14">
      <div className="flex items-end justify-center gap-3 sm:gap-6">
        {podiumOrder.map((displayIdx) => {
          const rider = top3[displayIdx];
          if (!rider) return <div key={displayIdx} className="w-1/3" />;

          const style = podiumStyles[displayIdx];
          const BadgeIcon =
            rider.badgeIcon ? badgeIcons[rider.badgeIcon] : null;

          const podiumContent = (
            <>
              {/* Rank number */}
              <span
                className={`mb-2 font-bold opacity-30 ${style.rankSize} ${style.label}`}
              >
                #{displayIdx + 1}
              </span>

              {/* Avatar */}
              <div
                className={`relative mb-3 overflow-hidden rounded-full ${style.avatar} ${style.ring} ${style.glow} transition-transform duration-300 ${canLinkProfiles ? "group-hover:scale-105" : ""}`}
              >
                {rider.avatarUrl ? (
                  <img
                    src={rider.avatarUrl}
                    alt={rider.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-t2w-surface text-lg font-bold text-t2w-muted sm:text-xl">
                    {getInitials(rider.name)}
                  </div>
                )}
              </div>

              {/* Name */}
              <p className="mb-1 text-center text-sm font-semibold text-white sm:text-base">
                {rider.name.split(" ").slice(0, 2).join(" ")}
              </p>

              {/* Badge tier */}
              {rider.badgeTier && BadgeIcon && (
                <span
                  className={`mb-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium sm:text-xs ${style.badge}`}
                >
                  <BadgeIcon className="h-3 w-3" />
                  {rider.badgeTier}
                </span>
              )}

              {/* Arena score */}
              <div
                className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold sm:text-sm ${style.badge}`}
              >
                <Trophy className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                {rider.arenaScore.toFixed(1)}
              </div>

              {/* Podium bar */}
              <div
                className={`mt-3 w-full rounded-t-xl ${style.bg} ${style.height} border-t border-l border-r border-white/5`}
              />
            </>
          );

          return canLinkProfiles ? (
            <Link
              key={rider.id}
              href={`/rider/${rider.id}`}
              className="group flex w-1/3 flex-col items-center"
            >
              {podiumContent}
            </Link>
          ) : (
            <div key={rider.id} className="flex w-1/3 flex-col items-center">
              {podiumContent}
            </div>
          );
        })}
      </div>
    </section>
  );
}
