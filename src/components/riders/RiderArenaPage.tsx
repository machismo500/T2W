"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";
import { ArenaHero } from "./ArenaHero";
import { ArenaPodium } from "./ArenaPodium";
import { ArenaLeaderboard } from "./ArenaLeaderboard";
import { computeArenaScore } from "./types";
import type { ArenaRider } from "./types";
import type { Badge } from "@/types";

function assignBadgeTier(totalKm: number, badgeTiers: Badge[]) {
  // Find highest badge tier the rider qualifies for
  let badge = null;
  for (const b of badgeTiers) {
    if (totalKm >= b.minKm) badge = b;
  }
  return badge;
}

export type ArenaPeriod = "all" | "1y" | "6m";

export function RiderArenaPage() {
  const { user } = useAuth();
  const [riders, setRiders] = useState<ArenaRider[]>([]);
  const [badgeTiers, setBadgeTiers] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<ArenaPeriod>("all");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.riders.list(undefined, period),
      api.badges.list(),
    ])
      .then(([data, badgesData]: [{ riders: Array<Record<string, unknown>> }, { badges: Badge[] }]) => {
        const tiers = (badgesData.badges || []).sort((a: Badge, b: Badge) => a.minKm - b.minKm);
        setBadgeTiers(tiers);

        const mapped: ArenaRider[] = data.riders
          .filter((r: Record<string, unknown>) => (r.ridesCompleted as number) > 0 || (r.totalKm as number) > 0)
          .map((r: Record<string, unknown>) => {
            const badge = assignBadgeTier(r.totalKm as number, tiers);
            const score = computeArenaScore({
              ridesCompleted: r.ridesCompleted as number,
              ridesOrganized: r.ridesOrganized as number,
              sweepsDone: r.sweepsDone as number,
              totalKm: r.totalKm as number,
            });
            return {
              id: r.id as string,
              name: r.name as string,
              email: r.email as string,
              avatarUrl: r.avatarUrl as string | null,
              userRole: r.userRole as string | null,
              joinDate: r.joinDate as string,
              ridesCompleted: r.ridesCompleted as number,
              totalKm: r.totalKm as number,
              totalPoints: r.totalPoints as number,
              ridesOrganized: r.ridesOrganized as number,
              sweepsDone: r.sweepsDone as number,
              pilotsDone: r.pilotsDone as number,
              arenaScore: score,
              badgeTier: badge?.tier || null,
              badgeIcon: badge?.icon || null,
              badgeColor: badge?.color || null,
            };
          })
          .sort((a: ArenaRider, b: ArenaRider) => b.arenaScore - a.arenaScore);

        setRiders(mapped);
      })
      .catch((err: Error) => {
        console.error("Failed to load riders:", err);
      })
      .finally(() => setLoading(false));
  }, [period]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-t2w-dark">
        <Loader2 className="h-8 w-8 animate-spin text-t2w-accent" />
      </div>
    );
  }

  const totalKm = riders.reduce((sum, r) => sum + r.totalKm, 0);
  const totalRides = riders.reduce((sum, r) => sum + r.ridesCompleted, 0);

  return (
    <div className="min-h-screen bg-t2w-dark">
      <ArenaHero
        totalRiders={riders.length}
        totalKm={totalKm}
        totalRides={totalRides}
        period={period}
        onPeriodChange={setPeriod}
      />
      <ArenaPodium riders={riders} />
      <ArenaLeaderboard
        riders={riders}
        currentUserId={user?.linkedRiderId}
        badgeTiers={badgeTiers}
      />
    </div>
  );
}
