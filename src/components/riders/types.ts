export interface ArenaRider {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  userRole?: string | null;
  joinDate: string;
  ridesCompleted: number;
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
  ridesCompleted: number;
  ridesOrganized: number;
  sweepsDone: number;
  totalKm: number;
};

export const DEFAULT_ARENA_WEIGHTS: ArenaWeights = {
  ridesCompleted: 5,
  ridesOrganized: 5,
  sweepsDone: 2.5,
  totalKm: 0.01,
};

// Backward-compatible alias
export const ARENA_WEIGHTS = DEFAULT_ARENA_WEIGHTS;

export function computeArenaScore(
  rider: {
    ridesCompleted: number;
    ridesOrganized: number;
    sweepsDone: number;
    totalKm: number;
  },
  weights: ArenaWeights = DEFAULT_ARENA_WEIGHTS
): number {
  return (
    rider.ridesCompleted * weights.ridesCompleted +
    rider.ridesOrganized * weights.ridesOrganized +
    rider.sweepsDone * weights.sweepsDone +
    rider.totalKm * weights.totalKm
  );
}
