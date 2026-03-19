// ── User Roles ──
// superadmin: Full access - create users, manage roles, CRUD rides, approve content, edit all profiles
// core_member: Can create rides, approve blogs/posts
// t2w_rider: Participated in at least 1 ride - can post blogs (subject to approval)
// rider: Registered but never participated in a T2W ride
// guest: Not registered (browsing only)
export type UserRole = "superadmin" | "core_member" | "t2w_rider" | "rider" | "guest";

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  role: UserRole;
  joinDate: string;
  isApproved: boolean;
  motorcycles: Motorcycle[];
  badges: Badge[];
  totalKm: number;
  ridesCompleted: number;
  linkedRiderId?: string; // links to a RiderProfile by id (matched via email)
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
  startLocationUrl?: string;
  endLocation: string;
  endLocationUrl?: string;
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
  riders?: string[];
  regFormSettings?: Record<string, unknown> | null;
  regOpenCore?: string | null;
  regOpenT2w?: string | null;
  regOpenRider?: string | null;
  participations?: {
    id: string;
    riderProfileId: string;
    riderName: string;
    riderAvatar?: string;
    droppedOut: boolean;
    points: number;
  }[];
  accountsBy?: string;
  organisedBy?: string;
  meetupTime?: string;
  rideStartTime?: string;
  startingPoint?: string;
}

export type BlogApprovalStatus = "pending" | "approved" | "rejected";

export interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  authorName: string;
  authorId?: string;
  authorAvatar?: string;
  publishDate: string;
  coverImage?: string;
  tags: string[];
  type: "official" | "personal";
  isVlog: boolean;
  videoUrl?: string;
  readTime: number;
  likes: number;
  approvalStatus: BlogApprovalStatus;
  approvedBy?: string;
}

// Ride post / tale shared in a ride's detail page
export interface RidePost {
  id: string;
  rideId: string;
  authorId: string;
  authorName: string;
  content: string;
  images?: string[];
  createdAt: string;
  approvalStatus: BlogApprovalStatus;
  approvedBy?: string;
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

// Ride registration data (based on registration form)
// ── Live Ride Tracking ──
export interface LiveRideSession {
  id: string;
  rideId: string;
  status: "waiting" | "live" | "paused" | "ended";
  startedAt?: string;
  endedAt?: string;
  leadRiderId?: string;
  sweepRiderId?: string;
  plannedRoute?: { lat: number; lng: number }[];
}

export interface LiveRiderLocation {
  userId: string;
  userName: string;
  userAvatar?: string;
  lat: number;
  lng: number;
  speed?: number;
  heading?: number;
  isDeviated: boolean;
  isLead: boolean;
  isSweep: boolean;
  recordedAt: string;
}

export interface LiveRideMetrics {
  elapsedMinutes: number;
  distanceKm: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  breakCount: number;
  breakMinutes: number;
  riderCount: number;
}

export interface RideRegistration {
  id: string;
  rideId: string;
  userId: string;
  riderName: string;
  address: string;
  email: string;
  phone: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  bloodGroup: string;
  referredBy: string;
  foodPreference: "vegetarian" | "non-vegetarian" | "";
  ridingType: "solo" | "rider-with-pillion" | "pillion-rider" | "";
  vehicleModel: string;
  vehicleRegNumber: string;
  tshirtSize: "XS" | "S" | "M" | "L" | "XL" | "XXL" | "XXXL" | "";
  agreedCancellationTerms: boolean;
  agreedIndemnity: boolean;
  paymentScreenshot: string;
  upiTransactionId: string;
  registeredAt: string;
  confirmationCode: string;
}
