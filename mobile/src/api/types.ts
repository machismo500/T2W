// Mirrors the response shapes from /api/v1/*. Kept thin — we add fields as
// the mobile UI needs them rather than mirroring every Prisma column.

export type UserRole = "rider" | "t2w_rider" | "core_member" | "superadmin";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatar: string | null;
  role: UserRole;
  city: string | null;
  ridingExperience: string | null;
  totalKm: number;
  ridesCompleted: number;
  isApproved: boolean;
  linkedRiderId: string | null;
  joinDate: string;
};

export type AuthTokens = {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
  refreshTokenExpiresAt: string;
};

export type LoginResponse = AuthTokens & { user: AuthUser };

export type RideStatus = "upcoming" | "ongoing" | "completed" | "cancelled";

export type RideListItem = {
  id: string;
  title: string;
  rideNumber: number;
  type: string;
  status: RideStatus;
  startDate: string;
  endDate: string;
  startLocation: string;
  endLocation: string;
  distanceKm: number;
  difficulty: string;
  posterUrl: string | null;
  fee: number;
  maxRiders: number;
  registeredRiders: number;
  myRegistrationStatus: "pending" | "confirmed" | "rejected" | null;
};

export type RideDetail = RideListItem & {
  startLocationUrl: string | null;
  endLocationUrl: string | null;
  route: Array<{ lat: number; lng: number }>;
  extraBedSlots: number;
  description: string | null;
  highlights: string[];
  leadRider: string | null;
  sweepRider: string | null;
  organisedBy: string | null;
  accountsBy: string | null;
  meetupTime: string | null;
  rideStartTime: string | null;
  startingPoint: string | null;
  regOpenCore: string | null;
  regOpenT2w: string | null;
  regOpenRider: string | null;
  confirmedRiders: Array<{ name: string; accommodationType: string }>;
  participations: Array<{
    riderProfileId: string;
    name: string | null;
    avatarUrl: string | null;
    droppedOut: boolean;
    points: number;
  }>;
  myRegistration: {
    id: string;
    confirmationCode: string | null;
    approvalStatus: string;
    accommodationType: string | null;
  } | null;
  myDroppedOut: boolean;
};

export type ApiError = {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
};

export type NotificationItem = {
  id: string;
  title: string;
  message: string;
  type: string;
  date: string;
};
