export interface ArenaRider {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  userRole?: string | null;
  joinDate: string;
  ridesCompleted: number;
  dayRides: number;
  weekendRides: number;
  multiDayRides: number;
  expeditionRides: number;
  totalKm: number;
  totalPoints: number;
  ridesOrganized: number;
  sweepsDone: number;
  pilotsDone: number;
  arenaScore: number;
  badgeTier?: string | null;
  badgeIcon?: string | null;
  badgeColor?: string | null;
}

export type SortField =
  | "arenaScore"
  | "totalKm"
  | "ridesCompleted"
  | "ridesOrganized"
  | "sweepsDone"
  | "pilotsDone"
  | "totalPoints"
  | "joinDate";

export type ArenaWeights = {
  ptsDay: number;
  ptsWeekend: number;
  ptsMultiDay: number;
  ptsExpedition: number;
  ridesOrganized: number;
  sweepsDone: number;
  totalKm: number;
};

export const DEFAULT_ARENA_WEIGHTS: ArenaWeights = {
  ptsDay: 5,
  ptsWeekend: 5,
  ptsMultiDay: 5,
  ptsExpedition: 10,
  ridesOrganized: 5,
  sweepsDone: 2.5,
  totalKm: 0.01,
};

// Backward-compatible alias
export const ARENA_WEIGHTS = DEFAULT_ARENA_WEIGHTS;

export function computeArenaScore(
  rider: {
    dayRides: number;
    weekendRides: number;
    multiDayRides: number;
    expeditionRides: number;
    ridesOrganized: number;
    sweepsDone: number;
    totalKm: number;
  },
  weights: ArenaWeights = DEFAULT_ARENA_WEIGHTS
): number {
  return (
    rider.dayRides * weights.ptsDay +
    rider.weekendRides * weights.ptsWeekend +
    rider.multiDayRides * weights.ptsMultiDay +
    rider.expeditionRides * weights.ptsExpedition +
    rider.ridesOrganized * weights.ridesOrganized +
    rider.sweepsDone * weights.sweepsDone +
    rider.totalKm * weights.totalKm
  );
}
