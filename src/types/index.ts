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
  notifyRides?: boolean; // user wants email notifications when new rides are posted
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
  activeRegistrations?: number;
  difficulty: "easy" | "moderate" | "challenging" | "extreme";
  description: string;
  highlights: string[];
  posterUrl?: string;
  fee: number;
  extraBedSlots?: number;
  extraBedFee?: number;
  leadRider: string;
  sweepRider: string;
  riders?: string[];
  regFormSettings?: Record<string, unknown> | null;
  regOpenCore?: string | null;
  regOpenT2w?: string | null;
  regOpenRider?: string | null;
  /** Set when the request is authenticated and the user has registered for this ride. */
  myRegistrationStatus?: "pending" | "confirmed" | "rejected" | null;
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

// ── Rider Profile ──
export interface RiderProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  emergencyContact: string;
  emergencyPhone: string;
  bloodGroup: string;
  joinDate: string;
  ridesCompleted: number;
  totalKm: number;
  totalPoints: number;
  ridesOrganized: number;
  sweepsDone: number;
  pilotsDone: number;
  avatarUrl?: string;
  userRole?: string | null;
  ridesParticipated: {
    rideId: string;
    rideNumber: string;
    rideTitle: string;
    rideDate: string;
    distanceKm: number;
    points: number;
  }[];
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
  breaks?: { id: string; startedAt: string; endedAt?: string; reason?: string | null }[];
  smoothedAt?: string | null;
  elevationGainM?: number | null;
  elevationLossM?: number | null;
  distanceKmOverride?: number | null;
  avgSpeedKmhOverride?: number | null;
  maxSpeedKmhOverride?: number | null;
  movingMinutesOverride?: number | null;
}

// Track point shape used everywhere the recorded path travels through the
// client. Server endpoints (live/route, smoothed/route) emit this; the map
// renderer reads it to colour segments, mark interpolated stretches, and
// dim low-accuracy fixes.
export interface TrackPoint {
  lat: number;
  lng: number;
  recordedAt?: string;
  // GPS-fix speed in km/h. Null when the device didn't report speed (e.g.
  // very low movement or older readings).
  speed?: number | null;
  // GPS accuracy radius in metres. Null on smoothed/interpolated points.
  accuracy?: number | null;
  // Smoothed-track flags, set only by the LiveRideLocationSmoothed source.
  isInterpolated?: boolean;
  isSnapped?: boolean;
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
  movingMinutes: number;
  distanceKm: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  breakCount: number;
  breakMinutes: number;
  riderCount: number;
  startedAt: string | null;
  endedAt: string | null;
  elevationGainM: number | null;
  elevationLossM: number | null;
  // Min/max/net + gain/loss roll-up derived from the cached elevation
  // profile. null when no profile has been computed yet (no track or pre-
  // backfill window). minM/maxM/netM are null when only the legacy
  // gain/loss columns are populated (rare — old sessions backfilled before
  // the profile cache existed).
  elevation?: {
    minM: number | null;
    maxM: number | null;
    netM: number | null;
    gainM: number | null;
    lossM: number | null;
  } | null;
  // Per-rider stats for the requesting user, server-side computed using the
  // same methodology as the lead-rider stats above. null when the user has no
  // tracked points on this session.
  me?: {
    distanceKm: number;
    distanceSource: "smoothed" | "raw";
    movingMinutes: number;
    avgSpeedKmh: number;
    maxSpeedKmh: number;
    pointsCount: number;
  } | null;
}

// Post-ride analytics fetched on demand from /api/rides/[id]/live/analytics.
// Computed lazily; can return null sections when the underlying data isn't
// available (no profile, single rider, etc.).
export interface RideAnalytics {
  splits: {
    index: number;
    distanceKm: number;
    durationSec: number;
    avgSpeedKmh: number;
    elevGainM: number | null;
    elevLossM: number | null;
  }[];
  climb: {
    longest: { distanceKm: number; gainM: number; startKm: number; endKm: number } | null;
    steepest: { gradePct: number; gainM: number; startKm: number; endKm: number } | null;
  };
  elevation: {
    minM: number;
    maxM: number;
    netM: number;
    gainM: number;
    lossM: number;
  } | null;
  cohesion: {
    maxGapKm: number;
    medianGapKm: number;
    togetherPct: number;
    deviationEvents: number;
    riderCount: number;
    togetherThresholdKm: number;
  } | null;
  leaderboard: {
    userId: string;
    name: string;
    avatar?: string | null;
    distanceKm: number;
    movingMinutes: number;
    avgSpeedKmh: number;
    maxSpeedKmh: number;
    pointCount: number;
    deviationCount: number;
    isLead: boolean;
    isSweep: boolean;
  }[];
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
  accommodationType?: string;
  agreedCancellationTerms: boolean;
  agreedIndemnity: boolean;
  paymentScreenshot: string;
  upiTransactionId: string;
  registeredAt: string;
  confirmationCode: string;
}
