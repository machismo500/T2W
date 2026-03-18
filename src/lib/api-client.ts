import {
  mockNotifications,
  mockPendingUsers,
  mockAllUsers,
  mockContentItems,
} from "@/data/mock";
import {
  type RiderProfile,
} from "@/data/rider-profiles";
import type { Ride, BlogPost, User, UserRole, RidePost, BlogApprovalStatus, RideRegistration } from "@/types";

// ── Rider cache (fetched from /api/riders, replaces grid-store dependency) ──
let _riderCache: RiderProfile[] | null = null;
let _riderCacheTime = 0;
const CACHE_TTL = 30000; // 30 seconds

async function getCachedRiders(): Promise<RiderProfile[]> {
  if (_riderCache && Date.now() - _riderCacheTime < CACHE_TTL) return _riderCache;
  try {
    const res = await fetch("/api/riders");
    if (res.ok) {
      const data = await res.json();
      _riderCache = data.riders || [];
      _riderCacheTime = Date.now();
      return _riderCache!;
    }
  } catch { /* fall back to stale cache */ }
  return _riderCache || [];
}

async function getRiderProfiles(): Promise<RiderProfile[]> {
  return getCachedRiders();
}

async function getRiderNameToIdMap(): Promise<Record<string, string>> {
  const riders = await getCachedRiders();
  const map: Record<string, string> = {};
  for (const r of riders) {
    map[r.name.toLowerCase().trim()] = r.id;
  }
  return map;
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
const USERS_KEY = "t2w_users";
const ROLE_OVERRIDES_KEY = "t2w_role_overrides"; // userId -> role
const NOTIF_KEY = "t2w_notif_read";
const DELETED_USERS_KEY = "t2w_deleted_users";
const AVATARS_KEY = "t2w_avatars"; // riderId -> base64 data URL (client-side cache)

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

// ── Built-in seed users (super admins only) ──
async function getBuiltinUsers(): Promise<StoredUser[]> {
  const riders = await getCachedRiders();
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
      linkedRiderId: riders.find((r) => r.email.toLowerCase() === "roshan.manuel@gmail.com")?.id,
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


async function getRegisteredUsers(): Promise<StoredUser[]> {
  const stored = getStorage<StoredUser[]>(USERS_KEY, []);
  // Merge: built-in users take precedence for their emails
  const builtinUsers = await getBuiltinUsers();
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

async function saveCustomUsers(users: StoredUser[]): Promise<void> {
  const builtinUsers = await getBuiltinUsers();
  const builtinEmails = new Set(
    builtinUsers.map((u) => u.email.toLowerCase())
  );
  const toSave = users.filter(
    (u) => !builtinEmails.has(u.email.toLowerCase())
  );
  setStorage(USERS_KEY, toSave);
}

// ── Blogs (DB-backed via /api/blogs) ──
async function fetchBlogs(): Promise<BlogPost[]> {
  try {
    const res = await fetch("/api/blogs");
    if (res.ok) {
      const data = await res.json();
      return data.blogs || [];
    }
  } catch { /* fall through */ }
  return [];
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

// ── API object ──
// Note: Authentication is handled by AuthContext via /api/auth/* server routes.
// The api.auth.* methods have been removed as they were dead localStorage-based code.
export const api = {
  users: {
    list: async (params?: string) => {
      await delay(150);
      if (params?.includes("pending")) {
        return { users: mockPendingUsers };
      }

      // Fetch DB roles from /api/riders (includes userRole from RiderProfile.role)
      let dbRoles: Record<string, string> = {}; // email -> role
      let dbRolesById: Record<string, string> = {}; // id -> role
      try {
        const res = await fetch("/api/riders");
        if (res.ok) {
          const data = await res.json();
          for (const r of (data.riders || []) as Array<{ id: string; email: string; userRole?: string | null }>) {
            if (r.userRole && r.userRole !== "rider") {
              dbRoles[r.email.toLowerCase().trim()] = r.userRole;
              dbRolesById[r.id] = r.userRole;
            }
          }
        }
      } catch { /* ignore - will fall back to localStorage roles */ }

      // Role overrides from localStorage (immediate UI update before DB propagates)
      const roleOverrides = getStorage<Record<string, UserRole>>(ROLE_OVERRIDES_KEY, {});

      // Helper: resolve role for a user/rider, preferring DB > localStorage override > default
      function resolveRole(id: string, email: string, defaultRole: string): string {
        const emailKey = email.toLowerCase().trim();
        return dbRoles[emailKey] || dbRolesById[id] || roleOverrides[id] || defaultRole;
      }

      // Start with registered users (built-in + localStorage signups)
      const registeredUsers = await getRegisteredUsers();
      const combined: Array<{
        id: string;
        name: string;
        email: string;
        role: string;
        isApproved: boolean;
        joinDate: string;
      }> = [];

      // 1. Add all mockAllUsers, merging role from DB/overrides/registeredUsers
      const addedEmails = new Set<string>();
      mockAllUsers.forEach((u) => {
        const reg = registeredUsers.find(
          (r) => r.email.toLowerCase() === u.email.toLowerCase()
        );
        const baseRole = reg ? reg.role : u.role;
        combined.push({ ...u, role: resolveRole(u.id, u.email, baseRole) });
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
            role: resolveRole(r.id, r.email, r.role),
            isApproved: r.isApproved,
            joinDate: r.joinDate,
          });
          addedEmails.add(r.email.toLowerCase());
        });

      // 3. Add all rider profiles from DB
      const riderProfiles = await getRiderProfiles();
      riderProfiles.forEach((rider) => {
        if (addedEmails.has(rider.email.toLowerCase())) return;
        const defaultRole = rider.ridesCompleted > 0 ? "t2w_rider" : "rider";
        combined.push({
          id: rider.id,
          name: rider.name,
          email: rider.email,
          role: resolveRole(rider.id, rider.email, defaultRole),
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
      const users = await getRegisteredUsers();
      const user = users.find((u) => u.id === id);
      if (user) {
        // Update all provided fields
        if (data.role) user.role = data.role as UserRole;
        if (data.name !== undefined) user.name = String(data.name);
        if (data.email !== undefined) user.email = String(data.email);
        if (data.phone !== undefined) user.phone = String(data.phone);
        await saveCustomUsers(users);
      } else {
        // User may exist only in DB riders or mockAllUsers.
        // Create a custom record so changes persist.
        const staticUser = mockAllUsers.find((u) => u.id === id);
        const allRiders = await getRiderProfiles();
        const riderProfile = allRiders.find((r) => r.id === id);
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
          await saveCustomUsers(allUsers);
        }
      }
      return { user: { id, ...data } };
    },
    delete: async (id: string) => {
      await delay(200);
      // Remove from custom users in localStorage
      const builtinUsers = await getBuiltinUsers();
      const builtinIds = new Set(builtinUsers.map((b) => b.id));
      const custom = (await getRegisteredUsers()).filter((u) => !builtinIds.has(u.id));
      await saveCustomUsers(custom.filter((u) => u.id !== id));
      // Track deletion so static/mock users don't reappear
      addDeletedUserIds([id]);
      return { success: true, id };
    },
    bulkDelete: async (ids: string[]) => {
      await delay(300);
      const builtinUsers = await getBuiltinUsers();
      const builtinIds = new Set(builtinUsers.map((b) => b.id));
      const custom = (await getRegisteredUsers()).filter((u) => !builtinIds.has(u.id));
      const idsSet = new Set(ids);
      await saveCustomUsers(custom.filter((u) => !idsSet.has(u.id)));
      // Track deletion so static/mock users don't reappear
      addDeletedUserIds(ids);
      return { success: true, deletedCount: ids.length };
    },
    approve: async (id: string) => {
      await delay(200);
      const users = await getRegisteredUsers();
      const user = users.find((u) => u.id === id);
      if (user) {
        user.isApproved = true;
        await saveCustomUsers(users);
      }
      return { success: true, id };
    },
    reject: async (id: string) => {
      await delay(200);
      return { success: true, id };
    },
    // Change role (SuperAdmin only) – persisted to DB + localStorage
    changeRole: async (id: string, newRole: UserRole) => {
      // Find the user's email for DB lookup
      const allRidersForRole = await getRiderProfiles();
      const riderProfile = allRidersForRole.find((r) => r.id === id);
      const email = riderProfile?.email || undefined;

      const res = await fetch("/api/users/role", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId: id, email, newRole }),
      });
      if (!res.ok) throw new Error("Failed to change role");
      const data = await res.json();
      return { success: true, id: data.userId || id, role: newRole };
    },
    // Get crew members (superadmin + core_member roles) for "The Crew" section
    getCrew: async () => {
      // Fetch crew from DB API (superadmin + core_member users with avatar URLs)
      try {
        const res = await fetch("/api/crew");
        if (res.ok) {
          const data = await res.json();
          if (data.crew && data.crew.length > 0) {
            // Enrich with localStorage avatars as fallback
            for (const m of data.crew) {
              if (!m.avatarUrl && m.linkedRiderId) {
                const localAvatar = api.avatars.get(m.linkedRiderId);
                const legacyAvatar = typeof window !== "undefined"
                  ? localStorage.getItem(`t2w_avatar_${m.linkedRiderId}`)
                  : null;
                m.avatarUrl = localAvatar || legacyAvatar || null;
              }
            }
            return data;
          }
        }
      } catch { /* fall through to localStorage fallback */ }

      // Fallback: use localStorage-based users if DB is unavailable
      const users = await getRegisteredUsers();
      const allRidersForCrew = await getRiderProfiles();
      const crewRoles = new Set(["superadmin", "core_member"]);
      const crew = users
        .filter((u) => crewRoles.has(u.role))
        .filter((u) => !u.email.toLowerCase().includes("taleson2wheels.official"))
        .map((u) => {
          const riderId = u.linkedRiderId || allRidersForCrew.find((r) => r.email.toLowerCase().trim() === u.email.toLowerCase().trim())?.id;
          const localAvatar = riderId ? api.avatars.get(riderId) : null;
          return {
            id: u.id,
            name: u.name,
            role: u.role,
            linkedRiderId: riderId,
            avatarUrl: localAvatar || null,
          };
        });
      return { crew };
    },
  },

  rides: {
    list: async () => {
      const res = await fetch("/api/rides");
      if (!res.ok) throw new Error("Failed to load rides");
      return res.json();
    },
    get: async (id: string) => {
      const res = await fetch(`/api/rides/${id}`);
      if (!res.ok) throw new Error("Ride not found");
      return res.json();
    },
    create: async (data: Record<string, unknown>) => {
      const res = await fetch("/api/rides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create ride");
      return res.json();
    },
    update: async (id: string, data: Record<string, unknown>) => {
      const res = await fetch(`/api/rides/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update ride");
      return res.json();
    },
    delete: async (id: string) => {
      const res = await fetch(`/api/rides/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete ride");
      return res.json();
    },
    register: async (id: string, data?: Record<string, unknown>) => {
      const res = await fetch(`/api/rides/${id}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Registration failed" }));
        throw new Error(err.error || "Registration failed");
      }
      return res.json();
    },
    unregister: async (id: string) => {
      await delay(200);
      return { success: true, id };
    },
    addRider: async (rideId: string, riderName: string) => {
      // Get current ride, add rider, update via API
      const rideRes = await fetch(`/api/rides/${rideId}`);
      if (!rideRes.ok) throw new Error("Ride not found");
      const { ride } = await rideRes.json();
      const riders: string[] = ride.riders || [];
      if (!riders.includes(riderName)) riders.push(riderName);
      await fetch(`/api/rides/${rideId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ riders }),
      });
      return { success: true, riders };
    },
    removeRider: async (rideId: string, riderName: string) => {
      const rideRes = await fetch(`/api/rides/${rideId}`);
      if (!rideRes.ok) throw new Error("Ride not found");
      const { ride } = await rideRes.json();
      const riders: string[] = (ride.riders || []).filter((r: string) => r !== riderName);
      await fetch(`/api/rides/${rideId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ riders }),
      });
      return { success: true, riders };
    },
  },

  exportRideRegistrations: async (rideId: string, rideTitle: string) => {
    let entries: RideRegistration[] = [];
    try {
      const res = await fetch(`/api/rides/${rideId}/registrations`);
      if (!res.ok) { alert("Failed to fetch registrations"); return; }
      const data = await res.json();
      entries = data.registrations || [];
    } catch {
      alert("Failed to fetch registrations");
      return;
    }
    if (entries.length === 0) {
      alert("No registrations found for this ride");
      return;
    }

    const headers = [
      "Rider Name", "Email", "Phone", "Address", "Emergency Contact Name",
      "Emergency Contact Phone", "Blood Group", "Food Preference", "Riding Type",
      "Vehicle Model", "Vehicle Reg Number", "T-Shirt Size", "Referred By",
      "Payment Screenshot", "UPI Transaction ID", "Registered At", "Confirmation Code",
    ];

    const escapeCsv = (val: string) => {
      if (!val) return "";
      if (val.includes(",") || val.includes('"') || val.includes("\n")) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };

    const rows = entries.map((r: RideRegistration) => [
      r.riderName, r.email, r.phone, r.address, r.emergencyContactName,
      r.emergencyContactPhone, r.bloodGroup, r.foodPreference, r.ridingType,
      r.vehicleModel, r.vehicleRegNumber, r.tshirtSize || "", r.referredBy,
      r.paymentScreenshot ? "Yes" : "No", r.upiTransactionId || "", r.registeredAt, r.confirmationCode,
    ].map(escapeCsv).join(","));

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${rideTitle.replace(/[^a-zA-Z0-9]/g, "_")}_registrations.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },

  regFormSettings: {
    get: async () => {
      try {
        const res = await fetch("/api/site-settings?key=reg_form_settings");
        if (res.ok) {
          const data = await res.json();
          if (data.value) return data.value;
        }
      } catch { /* fall through */ }
      return {};
    },
    save: async (settings: Record<string, unknown>) => {
      const res = await fetch("/api/site-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "reg_form_settings", value: settings }),
      });
      if (!res.ok) throw new Error("Failed to save settings");
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
      const blogs = await fetchBlogs();
      return { blogs };
    },
    listApproved: async () => {
      const blogs = await fetchBlogs();
      return { blogs: blogs.filter((b) => b.approvalStatus === "approved") };
    },
    listPending: async () => {
      const blogs = await fetchBlogs();
      return { blogs: blogs.filter((b) => b.approvalStatus === "pending") };
    },
    get: async (id: string) => {
      try {
        const res = await fetch(`/api/blogs/${id}`);
        if (res.ok) return res.json();
      } catch { /* fall through */ }
      return { blog: null };
    },
    create: async (data: Record<string, unknown>) => {
      const res = await fetch("/api/blogs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create blog");
      return res.json();
    },
    approve: async (id: string, _approvedBy: string) => {
      const res = await fetch(`/api/blogs/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvalStatus: "approved" }),
      });
      return { success: res.ok, id };
    },
    reject: async (id: string, _rejectedBy: string) => {
      const res = await fetch(`/api/blogs/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvalStatus: "rejected" }),
      });
      return { success: res.ok, id };
    },
    update: async (id: string, data: Record<string, unknown>) => {
      const res = await fetch(`/api/blogs/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update blog");
      return res.json();
    },
    delete: async (id: string) => {
      const res = await fetch(`/api/blogs/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete blog");
      return { success: true, id };
    },
  },

  ridePosts: {
    list: async (rideId: string) => {
      const res = await fetch(`/api/ride-posts?rideId=${rideId}`);
      if (!res.ok) return { posts: [] };
      return res.json();
    },
    listApproved: async (rideId: string) => {
      const res = await fetch(`/api/ride-posts?rideId=${rideId}&status=approved`);
      if (!res.ok) return { posts: [] };
      return res.json();
    },
    listPending: async () => {
      const res = await fetch(`/api/ride-posts?status=pending`);
      if (!res.ok) return { posts: [] };
      return res.json();
    },
    create: async (data: Record<string, unknown>) => {
      const res = await fetch("/api/ride-posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create ride post");
      return res.json();
    },
    approve: async (id: string, _approvedBy: string) => {
      const res = await fetch(`/api/ride-posts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvalStatus: "approved" }),
      });
      return { success: res.ok, id };
    },
    reject: async (id: string, _rejectedBy: string) => {
      const res = await fetch(`/api/ride-posts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvalStatus: "rejected" }),
      });
      return { success: res.ok, id };
    },
  },

  motorcycles: {
    list: async () => {
      const res = await fetch("/api/motorcycles");
      if (!res.ok) throw new Error("Failed to load motorcycles");
      return res.json();
    },
    create: async (data: Record<string, unknown>) => {
      const res = await fetch("/api/motorcycles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create motorcycle");
      return res.json();
    },
    update: async (id: string, data: Record<string, unknown>) => {
      const res = await fetch(`/api/motorcycles/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update motorcycle");
      return res.json();
    },
    delete: async (id: string) => {
      const res = await fetch(`/api/motorcycles/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete motorcycle");
      return res.json();
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
      try {
        const res = await fetch("/api/guidelines");
        if (res.ok) return res.json();
      } catch { /* fall through */ }
      return { guidelines: [] };
    },
    create: async (data: Record<string, unknown>) => {
      const res = await fetch("/api/guidelines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create guideline");
      return res.json();
    },
  },

  dashboard: {
    stats: async () => {
      const res = await fetch("/api/rides");
      const data = res.ok ? await res.json() : { rides: [] };
      const allRides = (data.rides || []) as Ride[];
      const mapRide = (r: Ride) => ({
        id: r.id, title: r.title, startDate: r.startDate, endDate: r.endDate,
        startLocation: r.startLocation, endLocation: r.endLocation,
        distanceKm: r.distanceKm, status: r.status,
      });
      return {
        completedRides: allRides.filter((r) => r.status === "completed").map(mapRide),
        upcomingRides: allRides.filter((r) => r.status === "upcoming").map(mapRide),
      };
    },
  },

  admin: {
    stats: async () => {
      const ridesRes = await fetch("/api/rides");
      const ridesData = ridesRes.ok ? await ridesRes.json() : { rides: [] };
      const allRides = (ridesData.rides || []) as Ride[];
      const allBlogs = await fetchBlogs();
      const pendingBlogs = allBlogs.filter(
        (b) => b.approvalStatus === "pending"
      );
      // Fetch pending ride posts from DB
      let pendingPostsCount = 0;
      try {
        const postsRes = await fetch("/api/ride-posts?status=pending");
        if (postsRes.ok) {
          const postsData = await postsRes.json();
          pendingPostsCount = (postsData.posts || []).length;
        }
      } catch { /* ignore */ }
      return {
        stats: {
          totalUsers: new Set([
            ...mockAllUsers.map((u) => u.email.toLowerCase()),
            ...(await getRegisteredUsers()).map((u) => u.email.toLowerCase()),
            ...(await getRiderProfiles()).map((r) => r.email.toLowerCase()),
          ]).size,
          pendingUsers: mockPendingUsers.length,
          activeRides: allRides.filter((r) => r.status === "upcoming").length,
          totalContent: mockContentItems.length,
          pendingBlogs: pendingBlogs.length,
          pendingPosts: pendingPostsCount,
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
      try {
        const res = await fetch("/api/activity-log");
        if (res.ok) return res.json();
      } catch { /* fall through */ }
      return { entries: [] };
    },
    add: async (entry: Omit<ActivityLogEntry, "id" | "timestamp">) => {
      try {
        await fetch("/api/activity-log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(entry),
        });
      } catch {
        // Best-effort logging
      }
    },
    rollback: async (entryId: string) => {
      // Fetch the entry to get rollback data
      const { entries } = await api.activityLog.list();
      const entry = entries.find((e: ActivityLogEntry) => e.id === entryId);
      if (!entry || !entry.rollbackData) {
        throw new Error("Cannot rollback this action");
      }

      const data = entry.rollbackData as Record<string, unknown>;

      switch (entry.action) {
        case "ride_deleted": {
          await fetch("/api/rides", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          }).catch(() => {});
          break;
        }
        case "ride_edited": {
          if (entry.targetId) {
            await fetch(`/api/rides/${entry.targetId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(data),
            }).catch(() => {});
          }
          break;
        }
        case "user_role_changed": {
          if (entry.targetId && data.previousRole) {
            await api.users.changeRole(entry.targetId, data.previousRole as UserRole);
          }
          break;
        }
        default:
          throw new Error("Rollback not supported for this action type");
      }

      // Mark as rolled back by updating the entry details
      await api.activityLog.add({
        action: "ride_edited" as ActivityAction,
        performedBy: entry.performedBy,
        performedByName: entry.performedByName,
        targetId: entry.targetId,
        targetName: entry.targetName,
        details: `Rolled back: ${entry.action}`,
      });

      return { success: true };
    },
  },

  // About T2W content (editable by Super Admin)
  aboutContent: {
    get: async () => {
      try {
        const res = await fetch("/api/site-settings?key=about_content");
        if (res.ok) {
          const data = await res.json();
          return { content: data.value || null };
        }
      } catch { /* fall through */ }
      return { content: null };
    },
    save: async (content: Record<string, string>) => {
      const res = await fetch("/api/site-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "about_content", value: content }),
      });
      if (!res.ok) throw new Error("Failed to save about content");
      return { success: true };
    },
  },

  // Avatar storage - persisted to DB via upload API
  avatars: {
    get: (riderId: string): string | null => {
      // Check localStorage cache first for immediate display
      const avatars = getStorage<Record<string, string>>(AVATARS_KEY, {});
      return avatars[riderId] || null;
    },
    save: (riderId: string, dataUrl: string) => {
      // Cache locally for immediate display
      const avatars = getStorage<Record<string, string>>(AVATARS_KEY, {});
      avatars[riderId] = dataUrl;
      setStorage(AVATARS_KEY, avatars);
    },
    // Upload file to server and persist URL in RiderProfile.avatarUrl
    upload: async (riderId: string, file: File): Promise<string> => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "avatar");
      formData.append("targetId", riderId);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Failed to upload avatar");
      const data = await res.json();
      // Cache the URL locally too
      const avatars = getStorage<Record<string, string>>(AVATARS_KEY, {});
      avatars[riderId] = data.url;
      setStorage(AVATARS_KEY, avatars);
      return data.url as string;
    },
  },

  // Badge management
  badges: {
    list: async () => {
      const res = await fetch("/api/badges");
      if (!res.ok) throw new Error("Failed to load badges");
      return res.json();
    },
    checkAndAward: async () => {
      const res = await fetch("/api/badges", { method: "POST" });
      if (!res.ok) throw new Error("Failed to check badges");
      return res.json();
    },
  },

  // File upload
  upload: async (file: File, type?: string, targetId?: string): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);
    if (type) formData.append("type", type);
    if (targetId) formData.append("targetId", targetId);
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    if (!res.ok) throw new Error("Failed to upload file");
    const data = await res.json();
    return data.url as string;
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
    markDropout: async (riderId: string, rideId: string, droppedOut: boolean) => {
      const res = await fetch("/api/riders/participation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ riderProfileId: riderId, rideId, droppedOut }),
      });
      if (!res.ok) throw new Error("Failed to update drop-out status");
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

  // ── Live Ride Session ──
  liveSession: {
    get: async (rideId: string) => {
      const res = await fetch(`/api/rides/${rideId}/live`);
      if (!res.ok) throw new Error("Failed to fetch live session");
      return res.json();
    },
    control: async (rideId: string, action: "start" | "pause" | "resume" | "end") => {
      const res = await fetch(`/api/rides/${rideId}/live`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error("Failed to control session");
      return res.json();
    },
    submitLocation: async (rideId: string, coords: { lat: number; lng: number; speed?: number; heading?: number; accuracy?: number }) => {
      const res = await fetch(`/api/rides/${rideId}/live/location`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(coords),
      });
      if (!res.ok) throw new Error("Failed to submit location");
      return res.json();
    },
    join: async (rideId: string) => {
      const res = await fetch(`/api/rides/${rideId}/live/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Failed to join session");
      return res.json();
    },
    breakControl: async (rideId: string, action: "start" | "end", reason?: string) => {
      const res = await fetch(`/api/rides/${rideId}/live/break`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      if (!res.ok) throw new Error("Failed to control break");
      return res.json();
    },
    metrics: async (rideId: string) => {
      const res = await fetch(`/api/rides/${rideId}/live/metrics`);
      if (!res.ok) throw new Error("Failed to fetch metrics");
      return res.json();
    },
  },

  seed: async () => {
    await delay(100);
    return { success: true, message: "Using database-backed data" };
  },
};
