import { apiFetch } from "./client";
import type { RideDetail, RideListItem } from "./types";

export type RideListPage = {
  items: RideListItem[];
  nextCursor: string | null;
};

export async function listRides(opts: {
  status?: "upcoming" | "ongoing" | "completed" | "cancelled" | "all";
  cursor?: string;
  limit?: number;
} = {}): Promise<RideListPage> {
  return apiFetch<RideListPage>("/api/v1/rides", {
    query: { status: opts.status, cursor: opts.cursor, limit: opts.limit },
  });
}

export async function getRide(id: string): Promise<RideDetail> {
  const res = await apiFetch<{ ride: RideDetail }>(`/api/v1/rides/${id}`);
  return res.ride;
}

export type LiveLocationPoint = {
  lat: number;
  lng: number;
  speed?: number | null;
  heading?: number | null;
  accuracy?: number | null;
  recordedAt?: string;
};

export async function postLiveLocations(rideId: string, points: LiveLocationPoint[]) {
  return apiFetch<{ accepted: number; rejected: Array<{ index: number; reason: string }>; anyDeviation: boolean }>(
    `/api/v1/rides/${rideId}/live/location`,
    { method: "POST", body: { points } },
  );
}
