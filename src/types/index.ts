export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  role: "rider" | "admin" | "superadmin";
  joinDate: string;
  isApproved: boolean;
  motorcycles: Motorcycle[];
  badges: Badge[];
  totalKm: number;
  ridesCompleted: number;
}

export interface Motorcycle {
  id: string;
  make: string;
  model: string;
  year: number;
  cc: number;
  color: string;
  nickname?: string;
  imageUrl?: string;
}

export interface Ride {
  id: string;
  title: string;
  rideNumber: string;
  type: "day" | "weekend" | "multi-day" | "expedition";
  status: "upcoming" | "ongoing" | "completed" | "cancelled";
  startDate: string;
  endDate: string;
  startLocation: string;
  endLocation: string;
  route: string[];
  distanceKm: number;
  maxRiders: number;
  registeredRiders: number;
  difficulty: "easy" | "moderate" | "challenging" | "extreme";
  description: string;
  highlights: string[];
  posterUrl?: string;
  fee: number;
  leadRider: string;
  sweepRider: string;
}

export interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  author: string;
  authorAvatar?: string;
  publishDate: string;
  coverImage?: string;
  tags: string[];
  type: "official" | "personal";
  isVlog: boolean;
  videoUrl?: string;
  readTime: number;
  likes: number;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: "info" | "warning" | "success" | "ride";
  date: string;
  isRead: boolean;
}

export type BadgeTier =
  | "SILVER"
  | "GOLD"
  | "PLATINUM"
  | "DIAMOND"
  | "ACE"
  | "CONQUEROR";

export interface Badge {
  tier: BadgeTier;
  name: string;
  description: string;
  minKm: number;
  icon: string;
  color: string;
  earnedDate?: string;
}

export interface Guideline {
  id: string;
  title: string;
  content: string;
  category: "group" | "general" | "safety" | "maintenance";
  icon: string;
}
