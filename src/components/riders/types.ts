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

export const ARENA_WEIGHTS = {
  ridesCompleted: 5,
  ridesOrganized: 5,
  sweepsDone: 2.5,
  totalKm: 0.01,
} as const;

export function computeArenaScore(rider: {
  ridesCompleted: number;
  ridesOrganized: number;
  sweepsDone: number;
  totalKm: number;
}): number {
  return (
    rider.ridesCompleted * ARENA_WEIGHTS.ridesCompleted +
    rider.ridesOrganized * ARENA_WEIGHTS.ridesOrganized +
    rider.sweepsDone * ARENA_WEIGHTS.sweepsDone +
    rider.totalKm * ARENA_WEIGHTS.totalKm
  );
}
