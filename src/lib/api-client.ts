import {
  mockRides,
  mockBlogs,
  mockNotifications,
  mockCurrentUser,
  mockGuidelines,
  mockPendingUsers,
  mockAllUsers,
  mockContentItems,
  mockRidePosts,
} from "@/data/mock";
import {
  type RiderProfile,
} from "@/data/rider-profiles";
// Grid store still used for backward-compat in mock user/blog functions.
// Rider data is now served via /api/riders (database-backed).
import {
  getGridRiders,
  getGridRider,
  getGridRiderByEmail,
  getGridRiderNameToId,
  type GridRider,
} from "@/lib/grid-store";
import type { Ride, BlogPost, User, UserRole, RidePost, BlogApprovalStatus, RideRegistration } from "@/types";

// ── Grid-backed accessors (replacing static imports) ──
// These functions read from the grid store which is the single source of truth.
// The grid store is seeded from the Excel-imported static data and can be
// edited by the Super Admin via the participation matrix grid.
function getRiderProfiles(): GridRider[] {
  return getGridRiders();
}

function getRiderNameToIdMap(): Record<string, string> {
  return getGridRiderNameToId();
}

// ── Helpers ──
function delay(ms = 100) {
  return new Promise((r) => setTimeout(r, ms));
}

function getStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function setStorage(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
  // Dispatch a custom event so other components/tabs can react to data changes
  window.dispatchEvent(new CustomEvent("t2w-storage-update", { detail: { key } }));
}

// ── Storage keys ──
const AUTH_KEY = "t2w_auth";
const USERS_KEY = "t2w_users";
const PASSWORDS_KEY = "t2w_passwords"; // email -> password overrides
const ROLE_OVERRIDES_KEY = "t2w_role_overrides"; // userId -> role
const RIDE_REG_KEY = "t2w_ride_registrations";
const NOTIF_KEY = "t2w_notif_read";
const BLOGS_KEY = "t2w_blogs";
const RIDE_POSTS_KEY = "t2w_ride_posts";
const RIDES_KEY = "t2w_custom_rides";
const DELETED_USERS_KEY = "t2w_deleted_users";
const REG_FORM_SETTINGS_KEY = "t2w_reg_form_settings";
const ACTIVITY_LOG_KEY = "t2w_activity_log";
const ABOUT_CONTENT_KEY = "t2w_about_content"; // editable About T2W content
const AVATARS_KEY = "t2w_avatars"; // riderId -> base64 data URL (shared across users)
const EMAIL_OTP_KEY = "t2w_email_otp"; // email -> { code, expiresAt }
const RESET_OTP_KEY = "t2w_reset_otp"; // email -> { code, expiresAt }
const RESET_VERIFIED_KEY = "t2w_reset_verified"; // email -> expiresAt (verified session)
// Participation is now managed by grid-store.ts (the primary database)

// ── Activity Log ──
export type ActivityAction =
  | "ride_created"
  | "ride_edited"
  | "ride_deleted"
  | "user_approved"
  | "user_rejected"
  | "user_deleted"
  | "user_bulk_deleted"
  | "user_role_changed"
  | "blog_approved"
  | "blog_rejected"
  | "post_approved"
  | "post_rejected"
  | "content_deleted"
  | "form_settings_saved";

export type ActivityLogEntry = {
  id: string;
  action: ActivityAction;
  performedBy: string;
  performedByName: string;
  timestamp: string;
  targetId: string;
  targetName: string;
  details?: string;
  rollbackData?: unknown;
};

function getActivityLog(): ActivityLogEntry[] {
  return getStorage<ActivityLogEntry[]>(ACTIVITY_LOG_KEY, []);
}

function addActivityLog(
  entry: Omit<ActivityLogEntry, "id" | "timestamp">
) {
  const log = getActivityLog();
  log.unshift({
    ...entry,
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
  });
  // Keep last 200 entries
  if (log.length > 200) log.length = 200;
  setStorage(ACTIVITY_LOG_KEY, log);
}

// ── Registered user type (stored in localStorage) ──
interface StoredUser {
  id: string;
  name: string;
  email: string;
  password: string;
  phone: string;
  city: string;
  ridingExperience: string;
  motorcycle: string;
  role: UserRole;
  joinDate: string;
  isApproved: boolean;
  linkedRiderId?: string;
}

// ── Find rider profile by email match (uses grid store as primary) ──
function findRiderByEmail(email: string): GridRider | undefined {
  return getGridRiderByEmail(email);
}

// ── Determine role based on rider participation ──
function determineRoleForRider(rider: RiderProfile | undefined): UserRole {
  if (rider && rider.ridesCompleted > 0) return "t2w_rider";
  return "rider";
}

// ── Built-in seed users (super admins only) ──
function getBuiltinUsers(): StoredUser[] {
  return [
    {
      id: "admin-1",
      name: "Roshan Manuel",
      email: "roshan.manuel@gmail.com",
      password: "PingPong!2345",
      phone: "+91 9880141543",
      city: "Bangalore",
      ridingExperience: "veteran",
      motorcycle: "",
      role: "superadmin",
      joinDate: "2024-03-16",
      isApproved: true,
      linkedRiderId: getRiderProfiles().find((r) => r.email.toLowerCase() === "roshan.manuel@gmail.com")?.id,
    },
    {
      id: "admin-6",
      name: "T2W Official",
      email: "taleson2wheels.official@gmail.com",
      password: "admin123",
      phone: "",
      city: "Bangalore",
      ridingExperience: "veteran",
      motorcycle: "",
      role: "superadmin",
      joinDate: "2024-03-16",
      isApproved: true,
    },
  ];
}


function getRegisteredUsers(): StoredUser[] {
  const stored = getStorage<StoredUser[]>(USERS_KEY, []);
  // Merge: built-in users take precedence for their emails
  const builtinUsers = getBuiltinUsers();
  const builtinEmails = new Set(builtinUsers.map((u) => u.email.toLowerCase()));
  const customUsers = stored.filter(
    (u) => !builtinEmails.has(u.email.toLowerCase())
  );
  // Apply role overrides (persisted by SuperAdmin role changes)
  const roleOverrides = getStorage<Record<string, UserRole>>(ROLE_OVERRIDES_KEY, {});
  const allUsers = [...builtinUsers, ...customUsers];
  for (const user of allUsers) {
    if (roleOverrides[user.id]) {
      user.role = roleOverrides[user.id];
    }
  }
  return allUsers;
}

function saveCustomUsers(users: StoredUser[]) {
  const builtinEmails = new Set(
    getBuiltinUsers().map((u) => u.email.toLowerCase())
  );
  const toSave = users.filter(
    (u) => !builtinEmails.has(u.email.toLowerCase())
  );
  setStorage(USERS_KEY, toSave);
}

function buildUserData(dbUser: StoredUser): {
  user: Record<string, unknown>;
} {
  // Find linked rider profile from grid store (single source of truth)
  const linkedRider = dbUser.linkedRiderId
    ? getGridRider(dbUser.linkedRiderId)
    : findRiderByEmail(dbUser.email);

  const ridesCompleted = linkedRider?.ridesCompleted || 0;
  const totalKm = linkedRider?.totalKm || 0;

  return {
    user: {
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      phone: dbUser.phone,
      role: dbUser.role,
      joinDate: dbUser.joinDate,
      isApproved: dbUser.isApproved,
      city: dbUser.city,
      ridingExperience: dbUser.ridingExperience,
      totalKm,
      ridesCompleted,
      linkedRiderId: linkedRider?.id || dbUser.linkedRiderId || null,
      motorcycles:
        dbUser.role === "superadmin" || dbUser.role === "core_member"
          ? []
          : [],
      earnedBadges:
        dbUser.role === "superadmin"
          ? [
              {
                id: "ub-conqueror",
                earnedDate: dbUser.joinDate,
                badge: {
                  id: "b-conqueror",
                  tier: "CONQUEROR",
                  name: "Conqueror",
                  description: "Founding member and ride organiser",
                  minKm: 20000,
                  icon: "crown",
                  color: "#FF6B35",
                },
              },
            ]
          : [],
    },
  };
}

// ── Blogs with localStorage persistence ──
function getBlogs(): BlogPost[] {
  const custom = getStorage<BlogPost[]>(BLOGS_KEY, []);
  return [...mockBlogs, ...custom];
}

function saveCustomBlogs(blogs: BlogPost[]) {
  // Only save non-mock blogs
  const mockIds = new Set(mockBlogs.map((b) => b.id));
  setStorage(
    BLOGS_KEY,
    blogs.filter((b) => !mockIds.has(b.id))
  );
}

// ── Ride posts with localStorage persistence ──
function getRidePosts(): RidePost[] {
  return getStorage<RidePost[]>(RIDE_POSTS_KEY, mockRidePosts);
}

// ── Ride registrations ──
function getRideRegistrations(): Record<string, RideRegistration[]> {
  return getStorage(RIDE_REG_KEY, {});
}

// ── Notification state ──
function getReadNotifs(): string[] {
  return getStorage(NOTIF_KEY, []);
}

// ── Deleted users tracking ──
function getDeletedUserIds(): Set<string> {
  return new Set(getStorage<string[]>(DELETED_USERS_KEY, []));
}

function addDeletedUserIds(ids: string[]) {
  const current = getStorage<string[]>(DELETED_USERS_KEY, []);
  const updated = [...new Set([...current, ...ids])];
  setStorage(DELETED_USERS_KEY, updated);
}

// ── Custom rides ──
function getCustomRides(): Ride[] {
  return getStorage<Ride[]>(RIDES_KEY, []);
}

function getAllRides(): Ride[] {
  const custom = getCustomRides();
  const customIds = new Set(custom.map((r) => r.id));
  // Custom rides override mock rides with the same id
  return [...mockRides.filter((r) => !customIds.has(r.id)), ...custom];
}

// ── API object ──
export const api = {
  auth: {
    login: async (email: string, password: string) => {
      await delay(300);
      const users = getRegisteredUsers();
      const overrides = getStorage<Record<string, string>>(PASSWORDS_KEY, {});
      const emailLower = email.toLowerCase().trim();
      const found = users.find((u) => {
        if (u.email.toLowerCase() !== emailLower) return false;
        // Accept either the override password (from forgot password) or the original
        const override = overrides[emailLower];
        if (override && password === override) return true;
        return u.password === password;
      });
      if (!found) throw new Error("Invalid email or password");
      setStorage(AUTH_KEY, found.id);
      return buildUserData(found);
    },

    // Step 1: Send a 6-digit OTP to the user's registered email
    sendResetOtp: async (email: string) => {
      await delay(400);
      const users = getRegisteredUsers();
      const emailLower = email.toLowerCase().trim();
      const found = users.find((u) => u.email.toLowerCase() === emailLower);
      if (!found) throw new Error("No account found with this email");
      // Generate 6-digit OTP with 10-minute expiry
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = Date.now() + 10 * 60 * 1000;
      const otps = getStorage<Record<string, { code: string; expiresAt: number }>>(RESET_OTP_KEY, {});
      otps[emailLower] = { code, expiresAt };
      setStorage(RESET_OTP_KEY, otps);
      // Attempt to send OTP via server-side API route (fire-and-forget)
      fetch("/api/auth/send-reset-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailLower, name: found.name, otpCode: code }),
      }).catch(() => {
        // Email sending is best-effort; OTP is stored in localStorage regardless
      });
      return { success: true, emailSent: true };
    },

    // Step 2: Verify the OTP code the user received via email
    verifyResetOtp: async (email: string, code: string) => {
      await delay(200);
      const emailLower = email.toLowerCase().trim();
      const otps = getStorage<Record<string, { code: string; expiresAt: number }>>(RESET_OTP_KEY, {});
      const stored = otps[emailLower];
      if (!stored) throw new Error("No reset code found. Please request a new one.");
      if (Date.now() > stored.expiresAt) {
        delete otps[emailLower];
        setStorage(RESET_OTP_KEY, otps);
        throw new Error("Reset code has expired. Please request a new one.");
      }
      if (stored.code !== code.trim()) throw new Error("Invalid code. Please try again.");
      // OTP verified – remove it and create a short-lived verified session (5 min)
      delete otps[emailLower];
      setStorage(RESET_OTP_KEY, otps);
      const verified = getStorage<Record<string, number>>(RESET_VERIFIED_KEY, {});
      verified[emailLower] = Date.now() + 5 * 60 * 1000;
      setStorage(RESET_VERIFIED_KEY, verified);
      return { success: true };
    },

    // Step 3: Set new password (only after OTP verified)
    resetPassword: async (email: string, newPassword: string) => {
      await delay(200);
      const emailLower = email.toLowerCase().trim();
      // Check verified session
      const verified = getStorage<Record<string, number>>(RESET_VERIFIED_KEY, {});
      const expiresAt = verified[emailLower];
      if (!expiresAt || Date.now() > expiresAt) {
        delete verified[emailLower];
        setStorage(RESET_VERIFIED_KEY, verified);
        throw new Error("Reset session expired. Please start over.");
      }
      if (!newPassword || newPassword.length < 6) {
        throw new Error("Password must be at least 6 characters");
      }
      // Set the new password as override
      const overrides = getStorage<Record<string, string>>(PASSWORDS_KEY, {});
      overrides[emailLower] = newPassword;
      setStorage(PASSWORDS_KEY, overrides);
      // Clear verified session
      delete verified[emailLower];
      setStorage(RESET_VERIFIED_KEY, verified);
      return { success: true };
    },

    // Change password (after login, voluntarily)
    changePassword: async (email: string, newPassword: string) => {
      await delay(200);
      const emailLower = email.toLowerCase().trim();
      const overrides = getStorage<Record<string, string>>(PASSWORDS_KEY, {});
      overrides[emailLower] = newPassword;
      setStorage(PASSWORDS_KEY, overrides);
      return { success: true };
    },

    // Send OTP to email for verification (simulated)
    sendOtp: async (email: string) => {
      await delay(300);
      const emailLower = email.toLowerCase().trim();
      if (!emailLower || !emailLower.includes("@")) {
        throw new Error("Please enter a valid email address");
      }
      // Check if email already registered
      const users = getRegisteredUsers();
      if (users.find((u) => u.email.toLowerCase() === emailLower)) {
        throw new Error("An account with this email already exists");
      }
      // Generate 6-digit OTP
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
      const otps = getStorage<Record<string, { code: string; expiresAt: number }>>(EMAIL_OTP_KEY, {});
      otps[emailLower] = { code, expiresAt };
      setStorage(EMAIL_OTP_KEY, otps);
      // In production, this would send a real email
      console.info(`[T2W] OTP for ${email}: ${code}`);
      return { success: true, message: `Verification code sent to ${email}` };
    },

    // Verify OTP code
    verifyOtp: async (email: string, code: string) => {
      await delay(200);
      const emailLower = email.toLowerCase().trim();
      const otps = getStorage<Record<string, { code: string; expiresAt: number }>>(EMAIL_OTP_KEY, {});
      const stored = otps[emailLower];
      if (!stored) throw new Error("No verification code found. Please request a new one.");
      if (Date.now() > stored.expiresAt) {
        delete otps[emailLower];
        setStorage(EMAIL_OTP_KEY, otps);
        throw new Error("Verification code has expired. Please request a new one.");
      }
      if (stored.code !== code.trim()) throw new Error("Invalid verification code. Please try again.");
      // Mark as verified by removing from pending
      delete otps[emailLower];
      setStorage(EMAIL_OTP_KEY, otps);
      return { success: true, verified: true };
    },

    register: async (data: Record<string, unknown>) => {
      await delay(400);
      const users = getRegisteredUsers();
      const email = String(data.email || "").toLowerCase().trim();
      if (users.find((u) => u.email.toLowerCase() === email)) {
        throw new Error("An account with this email already exists");
      }

      // Check if this email matches an existing rider in the grid (primary database)
      const matchedRider = findRiderByEmail(email);
      const role = determineRoleForRider(matchedRider);

      // If email matches a grid rider, merge: use grid data as base, user-provided data as override
      const newUser: StoredUser = {
        id: matchedRider ? matchedRider.id : `user-${Date.now()}`,
        name: String(data.name || matchedRider?.name || ""),
        email: String(data.email || ""),
        password: String(data.password || ""),
        phone: String(data.phone || matchedRider?.phone || ""),
        city: String(data.city || ""),
        ridingExperience: String(data.ridingExperience || (matchedRider && matchedRider.ridesCompleted > 10 ? "veteran" : matchedRider && matchedRider.ridesCompleted > 3 ? "experienced" : "")),
        motorcycle: String(data.motorcycle || ""),
        role,
        joinDate: matchedRider?.joinDate || new Date().toISOString().split("T")[0],
        isApproved: role === "t2w_rider", // T2W riders auto-approved; regular riders need approval
        linkedRiderId: matchedRider?.id,
      };
      const allUsers = [...users, newUser];
      saveCustomUsers(allUsers);
      setStorage(AUTH_KEY, newUser.id);
      return buildUserData(newUser);
    },

    me: async () => {
      await delay(100);
      const userId = getStorage<string | null>(AUTH_KEY, null);
      if (!userId) throw new Error("Not authenticated");
      const users = getRegisteredUsers();
      const found = users.find((u) => u.id === userId);
      if (!found) throw new Error("User not found");
      return buildUserData(found);
    },

    logout: async () => {
      await delay(50);
      if (typeof window !== "undefined") localStorage.removeItem(AUTH_KEY);
      return { success: true };
    },
  },

  users: {
    list: async (params?: string) => {
      await delay(150);
      if (params?.includes("pending")) {
        return { users: mockPendingUsers };
      }
      // Start with registered users (built-in + localStorage signups)
      const registeredUsers = getRegisteredUsers();
      const combined: Array<{
        id: string;
        name: string;
        email: string;
        role: string;
        isApproved: boolean;
        joinDate: string;
      }> = [];

      // 1. Add all mockAllUsers, merging role from registeredUsers
      const addedEmails = new Set<string>();
      mockAllUsers.forEach((u) => {
        const reg = registeredUsers.find(
          (r) => r.email.toLowerCase() === u.email.toLowerCase()
        );
        combined.push(reg ? { ...u, role: reg.role } : u);
        addedEmails.add(u.email.toLowerCase());
      });

      // 2. Add registered users not already in the list
      registeredUsers
        .filter((r) => !addedEmails.has(r.email.toLowerCase()))
        .forEach((r) => {
          combined.push({
            id: r.id,
            name: r.name,
            email: r.email,
            role: r.role,
            isApproved: r.isApproved,
            joinDate: r.joinDate,
          });
          addedEmails.add(r.email.toLowerCase());
        });

      // 3. Add all rider profiles from past rides (as t2w_rider)
      getRiderProfiles().forEach((rider) => {
        if (addedEmails.has(rider.email.toLowerCase())) return;
        combined.push({
          id: rider.id,
          name: rider.name,
          email: rider.email,
          role: rider.ridesCompleted > 0 ? "t2w_rider" : "rider",
          isApproved: true,
          joinDate: rider.joinDate || "2024-03-16",
        });
        addedEmails.add(rider.email.toLowerCase());
      });

      // Filter out deleted users
      const deletedIds = getDeletedUserIds();
      return { users: combined.filter((u) => !deletedIds.has(u.id)) };
    },
    get: async (id: string) => {
      await delay(100);
      const u = mockAllUsers.find((u) => u.id === id);
      return { user: u || null };
    },
    update: async (id: string, data: Record<string, unknown>) => {
      await delay(200);
      const users = getRegisteredUsers();
      const user = users.find((u) => u.id === id);
      if (user) {
        // Update all provided fields
        if (data.role) user.role = data.role as UserRole;
        if (data.name !== undefined) user.name = String(data.name);
        if (data.email !== undefined) user.email = String(data.email);
        if (data.phone !== undefined) user.phone = String(data.phone);
        saveCustomUsers(users);
      } else {
        // User may exist only in static data (getRiderProfiles()/mockAllUsers).
        // Create a custom record so changes persist.
        const staticUser = mockAllUsers.find((u) => u.id === id);
        const riderProfile = getRiderProfiles().find((r) => r.id === id);
        const source = staticUser || riderProfile;
        if (source) {
          const newUser: StoredUser = {
            id: source.id,
            name: data.name !== undefined ? String(data.name) : source.name,
            email: data.email !== undefined ? String(data.email) : source.email,
            password: "",
            phone: data.phone !== undefined ? String(data.phone) : ("phone" in source ? String(source.phone) : ""),
            city: "",
            ridingExperience: "",
            motorcycle: "",
            role: (data.role as UserRole) || ("role" in source ? (source.role as UserRole) : "rider"),
            joinDate: "joinDate" in source ? String(source.joinDate) : new Date().toISOString().split("T")[0],
            isApproved: "isApproved" in source ? Boolean(source.isApproved) : true,
          };
          const allUsers = [...users, newUser];
          saveCustomUsers(allUsers);
        }
      }
      return { user: { id, ...data } };
    },
    delete: async (id: string) => {
      await delay(200);
      // Remove from custom users in localStorage
      const builtinIds = new Set(getBuiltinUsers().map((b) => b.id));
      const custom = getRegisteredUsers().filter((u) => !builtinIds.has(u.id));
      saveCustomUsers(custom.filter((u) => u.id !== id));
      // Track deletion so static/mock users don't reappear
      addDeletedUserIds([id]);
      return { success: true, id };
    },
    bulkDelete: async (ids: string[]) => {
      await delay(300);
      const builtinIds = new Set(getBuiltinUsers().map((b) => b.id));
      const custom = getRegisteredUsers().filter((u) => !builtinIds.has(u.id));
      const idsSet = new Set(ids);
      saveCustomUsers(custom.filter((u) => !idsSet.has(u.id)));
      // Track deletion so static/mock users don't reappear
      addDeletedUserIds(ids);
      return { success: true, deletedCount: ids.length };
    },
    approve: async (id: string) => {
      await delay(200);
      const users = getRegisteredUsers();
      const user = users.find((u) => u.id === id);
      if (user) {
        user.isApproved = true;
        saveCustomUsers(users);
      }
      return { success: true, id };
    },
    reject: async (id: string) => {
      await delay(200);
      return { success: true, id };
    },
    // Change role (SuperAdmin only) – persisted via role overrides map
    changeRole: async (id: string, newRole: UserRole) => {
      await delay(200);
      // Persist the role override for ALL user types (built-in, custom, static)
      const roleOverrides = getStorage<Record<string, UserRole>>(ROLE_OVERRIDES_KEY, {});
      roleOverrides[id] = newRole;
      setStorage(ROLE_OVERRIDES_KEY, roleOverrides);
      // Also update custom users if they exist there
      const users = getRegisteredUsers();
      const user = users.find((u) => u.id === id);
      if (user) {
        user.role = newRole;
        // Ensure linkedRiderId is set for crew display
        if (!user.linkedRiderId) {
          const linkedRider = findRiderByEmail(user.email);
          if (linkedRider) user.linkedRiderId = linkedRider.id;
        }
        saveCustomUsers(users);
      } else {
        // User may exist only in static data (getRiderProfiles()/mockAllUsers).
        // Create a custom record so the user shows up in queries.
        const staticUser = mockAllUsers.find((u) => u.id === id);
        const riderProfile = getRiderProfiles().find((r) => r.id === id);
        const source = staticUser || riderProfile;
        if (source) {
          // Try to link to a rider profile for avatar/stats
          const linkedRider = findRiderByEmail(source.email);
          const newUser: StoredUser = {
            id: source.id,
            name: source.name,
            email: source.email,
            password: "",
            phone: "phone" in source ? String(source.phone) : "",
            city: "",
            ridingExperience: "",
            motorcycle: "",
            role: newRole,
            joinDate: "joinDate" in source ? String(source.joinDate) : new Date().toISOString().split("T")[0],
            isApproved: "isApproved" in source ? Boolean(source.isApproved) : true,
            linkedRiderId: linkedRider?.id || ("id" in source ? source.id : undefined),
          };
          saveCustomUsers([...users, newUser]);
        }
      }
      return { success: true, id, role: newRole };
    },
    // Get crew members (superadmin + core_member roles) for "The Crew" section
    getCrew: async () => {
      await delay(100);
      const users = getRegisteredUsers();
      const crewRoles = new Set(["superadmin", "core_member"]);
      const crew = users
        .filter((u) => crewRoles.has(u.role))
        .map((u) => {
          // Try to resolve linkedRiderId by email if not set
          const riderId = u.linkedRiderId || findRiderByEmail(u.email)?.id;
          return {
            id: u.id,
            name: u.name,
            role: u.role,
            linkedRiderId: riderId,
          };
        });
      return { crew };
    },
  },

  rides: {
    list: async () => {
      await delay(200);
      return { rides: getAllRides() };
    },
    get: async (id: string) => {
      await delay(150);
      const ride = getAllRides().find((r) => r.id === id);
      if (!ride) throw new Error("Ride not found");
      const regs = getRideRegistrations();
      // Get rider names from API (database-backed)
      let dbRiderNames: string[] = [];
      try {
        const ridersRes = await fetch(`/api/riders?rideId=${id}`);
        if (ridersRes.ok) {
          const data = await ridersRes.json();
          const riders = data.riders || [];
          // Filter riders who participated in this ride
          dbRiderNames = riders
            .filter((r: Record<string, unknown>) => {
              const pMap = r.participationMap as Record<string, number> | undefined;
              return pMap && pMap[id] && pMap[id] > 0;
            })
            .map((r: Record<string, unknown>) => r.name as string);
        }
      } catch {
        // Fallback: use static ride.riders if API fails
      }
      const customRiders = ride.riders || [];
      const allRiderNames = [...new Set([...dbRiderNames, ...customRiders])];
      return {
        ride: {
          ...ride,
          registrations: regs[id] || [],
          riders: allRiderNames,
          registeredRiders: allRiderNames.length,
        },
      };
    },
    create: async (data: Record<string, unknown>) => {
      await delay(300);
      const newRide = { id: `ride-${Date.now()}`, ...data } as Ride;
      const custom = getCustomRides();
      custom.push(newRide);
      setStorage(RIDES_KEY, custom);
      return { ride: newRide };
    },
    update: async (id: string, data: Record<string, unknown>) => {
      await delay(200);
      const custom = getCustomRides();
      const idx = custom.findIndex((r) => r.id === id);
      if (idx !== -1) {
        custom[idx] = { ...custom[idx], ...data } as Ride;
        setStorage(RIDES_KEY, custom);
        return { ride: custom[idx] };
      }
      // For mock rides, store as a custom override
      const allRides = getAllRides();
      const mockRide = allRides.find((r) => r.id === id);
      if (mockRide) {
        const updated = { ...mockRide, ...data } as Ride;
        custom.push(updated);
        setStorage(RIDES_KEY, custom);
        return { ride: updated };
      }
      return { ride: { id, ...data } };
    },
    delete: async (id: string) => {
      await delay(200);
      const custom = getCustomRides();
      setStorage(
        RIDES_KEY,
        custom.filter((r) => r.id !== id)
      );
      return { success: true, id };
    },
    register: async (id: string, data?: Record<string, unknown>) => {
      await delay(400);
      const regs = getRideRegistrations();
      const userId =
        getStorage<string | null>(AUTH_KEY, null) || "anonymous";
      if (!regs[id]) regs[id] = [];

      // Check if already registered
      const existingReg = regs[id].find(
        (r: RideRegistration) => r.userId === userId
      );
      if (existingReg) {
        throw new Error("You are already registered for this ride");
      }

      const code = `T2W-${id.toUpperCase().slice(0, 10)}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      const registration: RideRegistration = {
        id: `reg-${Date.now()}`,
        rideId: id,
        userId,
        riderName: String(data?.riderName || ""),
        address: String(data?.address || ""),
        email: String(data?.email || ""),
        phone: String(data?.phone || ""),
        emergencyContactName: String(data?.emergencyContactName || ""),
        emergencyContactPhone: String(data?.emergencyContactPhone || ""),
        bloodGroup: String(data?.bloodGroup || ""),
        referredBy: String(data?.referredBy || ""),
        foodPreference: String(data?.foodPreference || "") as RideRegistration["foodPreference"],
        ridingType: String(data?.ridingType || "") as RideRegistration["ridingType"],
        vehicleModel: String(data?.vehicleModel || ""),
        vehicleRegNumber: String(data?.vehicleRegNumber || ""),
        agreedCancellationTerms: Boolean(data?.agreedCancellationTerms),
        agreedIndemnity: Boolean(data?.agreedIndemnity),
        paymentScreenshot: String(data?.paymentScreenshot || ""),
        registeredAt: new Date().toISOString(),
        confirmationCode: code,
      };

      regs[id].push(registration as unknown as RideRegistration);
      setStorage(RIDE_REG_KEY, regs);
      return { registration, confirmationCode: code };
    },
    unregister: async (id: string) => {
      await delay(200);
      return { success: true, id };
    },
    addRider: async (rideId: string, riderName: string) => {
      await delay(100);
      const custom = getCustomRides();
      const allRides = getAllRides();
      const existingCustomIdx = custom.findIndex((r) => r.id === rideId);
      if (existingCustomIdx !== -1) {
        const riders = custom[existingCustomIdx].riders || [];
        if (!riders.includes(riderName)) riders.push(riderName);
        custom[existingCustomIdx] = { ...custom[existingCustomIdx], riders, registeredRiders: riders.length } as Ride;
        setStorage(RIDES_KEY, custom);
        return { success: true, riders };
      }
      const mockRide = allRides.find((r) => r.id === rideId);
      if (mockRide) {
        const riders = [...(mockRide.riders || [])];
        if (!riders.includes(riderName)) riders.push(riderName);
        const updated = { ...mockRide, riders, registeredRiders: riders.length } as Ride;
        custom.push(updated);
        setStorage(RIDES_KEY, custom);
        return { success: true, riders };
      }
      throw new Error("Ride not found");
    },
    removeRider: async (rideId: string, riderName: string) => {
      await delay(100);
      const custom = getCustomRides();
      const allRides = getAllRides();
      const existingCustomIdx = custom.findIndex((r) => r.id === rideId);
      if (existingCustomIdx !== -1) {
        const riders = (custom[existingCustomIdx].riders || []).filter((r: string) => r !== riderName);
        custom[existingCustomIdx] = { ...custom[existingCustomIdx], riders, registeredRiders: riders.length } as Ride;
        setStorage(RIDES_KEY, custom);
        return { success: true, riders };
      }
      const mockRide = allRides.find((r) => r.id === rideId);
      if (mockRide) {
        const riders = (mockRide.riders || []).filter((r: string) => r !== riderName);
        const updated = { ...mockRide, riders, registeredRiders: riders.length } as Ride;
        custom.push(updated);
        setStorage(RIDES_KEY, custom);
        return { success: true, riders };
      }
      throw new Error("Ride not found");
    },
  },

  regFormSettings: {
    get: async () => {
      await delay(50);
      return getStorage<Record<string, unknown>>(REG_FORM_SETTINGS_KEY, {});
    },
    save: async (settings: Record<string, unknown>) => {
      await delay(100);
      setStorage(REG_FORM_SETTINGS_KEY, settings);
      return { success: true };
    },
  },

  riders: {
    list: async (search?: string) => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const res = await fetch(`/api/riders?${params}`);
      if (!res.ok) throw new Error("Failed to load riders");
      return res.json();
    },
    get: async (id: string) => {
      const res = await fetch(`/api/riders/${id}`);
      if (!res.ok) {
        const data = await res.json();
        if (data.mergedIntoId) {
          // Follow the merge redirect
          const res2 = await fetch(`/api/riders/${data.mergedIntoId}`);
          if (!res2.ok) throw new Error("Rider not found");
          return res2.json();
        }
        throw new Error("Rider not found");
      }
      return res.json();
    },
    update: async (id: string, data: Partial<RiderProfile>) => {
      const res = await fetch(`/api/riders/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update rider");
      return res.json();
    },
    create: async (data: Record<string, unknown>) => {
      const res = await fetch("/api/riders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create rider");
      return res.json();
    },
    delete: async (id: string) => {
      const res = await fetch(`/api/riders/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete rider");
      return res.json();
    },
    checkEmail: async (email: string) => {
      const res = await fetch("/api/riders/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error("Failed to check email");
      return res.json();
    },
    getByName: async (name: string) => {
      const data = await api.riders.list(name);
      const rider = (data.riders as RiderProfile[]).find(
        (r: RiderProfile) => r.name.toLowerCase().trim() === name.toLowerCase().trim()
      );
      return { rider: rider || null, riderId: rider?.id || null };
    },
  },

  blogs: {
    list: async (_params?: string) => {
      await delay(150);
      const allBlogs = getBlogs();
      return { blogs: allBlogs };
    },
    listApproved: async () => {
      await delay(150);
      const allBlogs = getBlogs();
      return {
        blogs: allBlogs.filter((b) => b.approvalStatus === "approved"),
      };
    },
    listPending: async () => {
      await delay(150);
      const allBlogs = getBlogs();
      return {
        blogs: allBlogs.filter((b) => b.approvalStatus === "pending"),
      };
    },
    get: async (id: string) => {
      await delay(100);
      const blog = getBlogs().find((b) => b.id === id);
      return { blog: blog || null };
    },
    create: async (data: Record<string, unknown>) => {
      await delay(300);
      const newBlog: BlogPost = {
        id: `blog-${Date.now()}`,
        title: String(data.title || ""),
        excerpt: String(data.excerpt || ""),
        content: String(data.content || ""),
        author: String(data.author || ""),
        authorId: String(data.authorId || ""),
        publishDate: new Date().toISOString().split("T")[0],
        tags: (data.tags as string[]) || [],
        type: (data.type as "official" | "personal") || "personal",
        isVlog: Boolean(data.isVlog),
        videoUrl: data.videoUrl as string | undefined,
        readTime: Number(data.readTime) || 5,
        likes: 0,
        approvalStatus: (data.approvalStatus as BlogApprovalStatus) || "pending",
        approvedBy: data.approvedBy as string | undefined,
      };
      const allBlogs = getBlogs();
      allBlogs.push(newBlog);
      saveCustomBlogs(allBlogs);
      return { blog: newBlog };
    },
    approve: async (id: string, approvedBy: string) => {
      await delay(200);
      const allBlogs = getBlogs();
      const blog = allBlogs.find((b) => b.id === id);
      if (blog) {
        blog.approvalStatus = "approved";
        blog.approvedBy = approvedBy;
        saveCustomBlogs(allBlogs);
      }
      return { success: true, id };
    },
    reject: async (id: string, rejectedBy: string) => {
      await delay(200);
      const allBlogs = getBlogs();
      const blog = allBlogs.find((b) => b.id === id);
      if (blog) {
        blog.approvalStatus = "rejected";
        blog.approvedBy = rejectedBy;
        saveCustomBlogs(allBlogs);
      }
      return { success: true, id };
    },
    update: async (id: string, data: Record<string, unknown>) => {
      await delay(200);
      return { blog: { id, ...data } };
    },
    delete: async (id: string) => {
      await delay(200);
      const allBlogs = getBlogs();
      saveCustomBlogs(allBlogs.filter((b) => b.id !== id));
      return { success: true, id };
    },
  },

  ridePosts: {
    list: async (rideId: string) => {
      await delay(100);
      const posts = getRidePosts();
      return { posts: posts.filter((p) => p.rideId === rideId) };
    },
    listApproved: async (rideId: string) => {
      await delay(100);
      const posts = getRidePosts();
      return {
        posts: posts.filter(
          (p) => p.rideId === rideId && p.approvalStatus === "approved"
        ),
      };
    },
    listPending: async () => {
      await delay(100);
      const posts = getRidePosts();
      return { posts: posts.filter((p) => p.approvalStatus === "pending") };
    },
    create: async (data: Record<string, unknown>) => {
      await delay(300);
      const newPost: RidePost = {
        id: `ridepost-${Date.now()}`,
        rideId: String(data.rideId || ""),
        authorId: String(data.authorId || ""),
        authorName: String(data.authorName || ""),
        content: String(data.content || ""),
        images: (data.images as string[]) || [],
        createdAt: new Date().toISOString(),
        approvalStatus: (data.approvalStatus as BlogApprovalStatus) || "pending",
        approvedBy: data.approvedBy as string | undefined,
      };
      const posts = getRidePosts();
      posts.push(newPost);
      setStorage(RIDE_POSTS_KEY, posts);
      return { post: newPost };
    },
    approve: async (id: string, approvedBy: string) => {
      await delay(200);
      const posts = getRidePosts();
      const post = posts.find((p) => p.id === id);
      if (post) {
        post.approvalStatus = "approved";
        post.approvedBy = approvedBy;
        setStorage(RIDE_POSTS_KEY, posts);
      }
      return { success: true, id };
    },
    reject: async (id: string, rejectedBy: string) => {
      await delay(200);
      const posts = getRidePosts();
      const post = posts.find((p) => p.id === id);
      if (post) {
        post.approvalStatus = "rejected";
        post.approvedBy = rejectedBy;
        setStorage(RIDE_POSTS_KEY, posts);
      }
      return { success: true, id };
    },
  },

  motorcycles: {
    list: async () => {
      await delay(100);
      return { motorcycles: mockCurrentUser.motorcycles };
    },
    create: async (data: Record<string, unknown>) => {
      await delay(300);
      return { motorcycle: { id: `moto-${Date.now()}`, ...data } };
    },
    update: async (id: string, data: Record<string, unknown>) => {
      await delay(200);
      return { motorcycle: { id, ...data } };
    },
    delete: async (id: string) => {
      await delay(200);
      return { success: true, id };
    },
  },

  notifications: {
    list: async () => {
      await delay(100);
      const readIds = getReadNotifs();
      const notifications = mockNotifications.map((n) => ({
        ...n,
        isRead: n.isRead || readIds.includes(n.id),
      }));
      return { notifications };
    },
    markRead: async (id: string) => {
      await delay(50);
      const readIds = getReadNotifs();
      if (!readIds.includes(id)) {
        readIds.push(id);
        setStorage(NOTIF_KEY, readIds);
      }
      return { success: true };
    },
  },

  guidelines: {
    list: async () => {
      await delay(100);
      return { guidelines: mockGuidelines };
    },
    create: async (data: Record<string, unknown>) => {
      await delay(200);
      return { guideline: { id: `guide-${Date.now()}`, ...data } };
    },
  },

  dashboard: {
    stats: async () => {
      await delay(200);
      const allRides = getAllRides();
      return {
        completedRides: allRides
          .filter((r) => r.status === "completed")
          .map((r) => ({
            id: r.id,
            title: r.title,
            startDate: r.startDate,
            endDate: r.endDate,
            startLocation: r.startLocation,
            endLocation: r.endLocation,
            distanceKm: r.distanceKm,
            status: r.status,
          })),
        upcomingRides: allRides
          .filter((r) => r.status === "upcoming")
          .map((r) => ({
            id: r.id,
            title: r.title,
            startDate: r.startDate,
            endDate: r.endDate,
            startLocation: r.startLocation,
            endLocation: r.endLocation,
            distanceKm: r.distanceKm,
            status: r.status,
          })),
      };
    },
  },

  admin: {
    stats: async () => {
      await delay(200);
      const allRides = getAllRides();
      const pendingBlogs = getBlogs().filter(
        (b) => b.approvalStatus === "pending"
      );
      const pendingPosts = getRidePosts().filter(
        (p) => p.approvalStatus === "pending"
      );
      return {
        stats: {
          totalUsers: new Set([
            ...mockAllUsers.map((u) => u.email.toLowerCase()),
            ...getRegisteredUsers().map((u) => u.email.toLowerCase()),
            ...getRiderProfiles().map((r) => r.email.toLowerCase()),
          ]).size,
          pendingUsers: mockPendingUsers.length,
          activeRides: allRides.filter((r) => r.status === "upcoming").length,
          totalContent: mockContentItems.length,
          pendingBlogs: pendingBlogs.length,
          pendingPosts: pendingPosts.length,
        },
      };
    },
    content: {
      list: async () => {
        await delay(150);
        return { content: mockContentItems };
      },
      create: async (data: Record<string, unknown>) => {
        await delay(300);
        return { content: { id: `content-${Date.now()}`, ...data } };
      },
      update: async (id: string, data: Record<string, unknown>) => {
        await delay(200);
        return { content: { id, ...data } };
      },
      delete: async (id: string) => {
        await delay(200);
        return { success: true, id };
      },
    },
  },

  activityLog: {
    list: async () => {
      await delay(50);
      return { entries: getActivityLog() };
    },
    add: (entry: Omit<ActivityLogEntry, "id" | "timestamp">) => {
      addActivityLog(entry);
    },
    rollback: async (entryId: string) => {
      await delay(100);
      const log = getActivityLog();
      const entry = log.find((e) => e.id === entryId);
      if (!entry || !entry.rollbackData) {
        throw new Error("Cannot rollback this action");
      }

      const data = entry.rollbackData as Record<string, unknown>;

      switch (entry.action) {
        case "ride_deleted": {
          // Re-add the deleted ride
          const custom = getCustomRides();
          custom.push(data as unknown as Ride);
          setStorage(RIDES_KEY, custom);
          break;
        }
        case "user_deleted": {
          // Re-add the deleted user
          const users = getRegisteredUsers();
          users.push(data as unknown as StoredUser);
          saveCustomUsers(users);
          // Remove from deleted IDs
          const deletedIds = getStorage<string[]>(DELETED_USERS_KEY, []);
          setStorage(DELETED_USERS_KEY, deletedIds.filter((id) => id !== entry.targetId));
          break;
        }
        case "user_bulk_deleted": {
          // Re-add all deleted users
          const bulkUsers = data.users as unknown as StoredUser[];
          const currentUsers = getRegisteredUsers();
          currentUsers.push(...bulkUsers);
          saveCustomUsers(currentUsers);
          const deletedBulkIds = getStorage<string[]>(DELETED_USERS_KEY, []);
          const restoredIds = new Set(bulkUsers.map((u) => u.id));
          setStorage(DELETED_USERS_KEY, deletedBulkIds.filter((id) => !restoredIds.has(id)));
          break;
        }
        case "ride_edited": {
          // Restore original ride data
          const ridecustom = getCustomRides();
          const rideIdx = ridecustom.findIndex((r) => r.id === entry.targetId);
          if (rideIdx !== -1) {
            ridecustom[rideIdx] = data as unknown as Ride;
          } else {
            ridecustom.push(data as unknown as Ride);
          }
          setStorage(RIDES_KEY, ridecustom);
          break;
        }
        case "user_role_changed": {
          // Restore original role
          const roleUsers = getRegisteredUsers();
          const roleUser = roleUsers.find((u) => u.id === entry.targetId);
          if (roleUser) {
            roleUser.role = data.previousRole as UserRole;
            saveCustomUsers(roleUsers);
          }
          break;
        }
        default:
          throw new Error("Rollback not supported for this action type");
      }

      // Mark as rolled back in the log
      const updatedLog = getActivityLog();
      const idx = updatedLog.findIndex((e) => e.id === entryId);
      if (idx !== -1) {
        updatedLog[idx] = { ...updatedLog[idx], rollbackData: undefined, details: (updatedLog[idx].details || "") + " [ROLLED BACK]" };
        setStorage(ACTIVITY_LOG_KEY, updatedLog);
      }

      return { success: true };
    },
  },

  // About T2W content (editable by Super Admin)
  aboutContent: {
    get: async () => {
      const saved = getStorage<Record<string, string> | null>(ABOUT_CONTENT_KEY, null);
      return { content: saved };
    },
    save: async (content: Record<string, string>) => {
      setStorage(ABOUT_CONTENT_KEY, content);
      return { success: true };
    },
  },

  // Shared avatar storage
  avatars: {
    get: (riderId: string): string | null => {
      const avatars = getStorage<Record<string, string>>(AVATARS_KEY, {});
      return avatars[riderId] || null;
    },
    save: (riderId: string, dataUrl: string) => {
      const avatars = getStorage<Record<string, string>>(AVATARS_KEY, {});
      avatars[riderId] = dataUrl;
      setStorage(AVATARS_KEY, avatars);
    },
  },

  // Rider-ride participation — backed by database
  participation: {
    getOverrides: (): Record<string, { added: string[]; removed: string[] }> => {
      return {};
    },
    toggle: async (riderId: string, rideId: string, participate: boolean) => {
      const res = await fetch("/api/riders/participation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ riderProfileId: riderId, rideId, points: participate ? 5 : 0 }),
      });
      if (!res.ok) throw new Error("Failed to update participation");
      return res.json();
    },
    setPoints: async (riderId: string, rideId: string, points: number) => {
      const res = await fetch("/api/riders/participation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ riderProfileId: riderId, rideId, points }),
      });
      if (!res.ok) throw new Error("Failed to set points");
      return res.json();
    },
    bulkSave: async (changes: Array<{ riderProfileId: string; rideId: string; points: number }>) => {
      const res = await fetch("/api/riders/participation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes }),
      });
      if (!res.ok) throw new Error("Failed to save participation");
      return res.json();
    },
    getEffectiveParticipation: async (riderId: string): Promise<string[]> => {
      try {
        const data = await api.riders.get(riderId);
        const rider = data.rider;
        if (!rider?.ridesParticipated) return [];
        return rider.ridesParticipated.map((r: { rideId: string }) => r.rideId);
      } catch {
        return [];
      }
    },
  },

  // Profile merging (super admin)
  merge: {
    findDuplicates: async () => {
      const res = await fetch("/api/riders/merge");
      if (!res.ok) throw new Error("Failed to find duplicates");
      return res.json();
    },
    mergeProfiles: async (sourceId: string, targetId: string) => {
      const res = await fetch("/api/riders/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId, targetId }),
      });
      if (!res.ok) throw new Error("Failed to merge profiles");
      return res.json();
    },
  },

  seed: async () => {
    await delay(100);
    return { success: true, message: "Using database-backed data" };
  },
};
