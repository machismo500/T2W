import { apiFetch } from "./client";

export type Motorcycle = {
  id: string;
  make: string;
  model: string;
  year: number;
  cc: number;
  color: string;
  nickname: string | null;
  imageUrl: string | null;
};

export type LeaderboardRider = {
  id: string;
  name: string;
  role: string;
  avatarUrl: string | null;
  totalKm: number;
  ridesCount: number;
  ridesOrganized: number;
  sweepsDone: number;
  pilotsDone: number;
  badges: Array<{ tier: string; name: string; icon: string; color: string }>;
};

export type Guideline = {
  id: string;
  title: string;
  content: string;
  category: string | null;
  icon: string | null;
};

export type BlogListItem = {
  id: string;
  title: string;
  excerpt: string;
  coverImage: string | null;
  authorName: string;
  authorAvatar: string | null;
  readTime: number;
  publishDate: string;
  videoUrl: string | null;
  isVlog: boolean;
  type: string;
  tags: string[];
  likes: number;
};

export async function listMotorcycles() {
  return apiFetch<{ motorcycles: Motorcycle[] }>("/api/v1/motorcycles");
}

export async function createMotorcycle(body: {
  make: string;
  model: string;
  year?: number;
  cc?: number;
  color?: string;
  nickname?: string;
}) {
  return apiFetch<{ motorcycle: Motorcycle }>("/api/v1/motorcycles", { method: "POST", body });
}

export async function deleteMotorcycle(id: string) {
  return apiFetch<{ success: true }>(`/api/v1/motorcycles/${id}`, { method: "DELETE" });
}

export async function leaderboard(period: "6m" | "1y" | "all" = "all") {
  return apiFetch<{ items: LeaderboardRider[] }>("/api/v1/riders", { query: { period } });
}

export async function listGuidelines() {
  return apiFetch<{ guidelines: Guideline[] }>("/api/v1/guidelines");
}

export async function listBlogs(cursor?: string | null) {
  return apiFetch<{ items: BlogListItem[]; nextCursor: string | null }>("/api/v1/blogs", {
    query: { cursor },
  });
}

export async function markNotificationRead(id: string) {
  return apiFetch<{ success: true }>(`/api/v1/notifications/${id}/read`, { method: "POST", body: {} });
}

export async function markAllNotificationsRead() {
  return apiFetch<{ updated: number }>(`/api/v1/notifications/read-all`, { method: "POST", body: {} });
}
