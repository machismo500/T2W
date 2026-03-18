import {
  mockNotifications,
  mockContentItems,
} from "@/data/mock";
import {
  type RiderProfile,
} from "@/data/rider-profiles";
import type { Ride, BlogPost, UserRole, RidePost, RideRegistration } from "@/types";

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

// ── Storage keys (client-side cache only) ──
const NOTIF_KEY = "t2w_notif_read";
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

// ── API object ──
// Note: Authentication is handled by AuthContext via /api/auth/* server routes.
// The api.auth.* methods have been removed as they were dead localStorage-based code.
export const api = {
  users: {
    list: async (params?: string) => {
      const status = params?.includes("pending") ? "pending" : "";
      const url = status ? `/api/users?status=${status}` : "/api/users";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load users");
      return res.json();
    },
    get: async (id: string) => {
      const res = await fetch(`/api/users/${id}`);
      if (!res.ok) return { user: null };
      return res.json();
    },
    update: async (id: string, data: Record<string, unknown>) => {
      const res = await fetch(`/api/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update user");
      return res.json();
    },
    delete: async (id: string) => {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete user");
      return res.json();
    },
    bulkDelete: async (ids: string[]) => {
      const res = await fetch("/api/users/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error("Failed to delete users");
      return res.json();
    },
    approve: async (id: string) => {
      const res = await fetch(`/api/users/${id}/approve`, { method: "PUT" });
      if (!res.ok) throw new Error("Failed to approve user");
      return res.json();
    },
    reject: async (id: string) => {
      const res = await fetch(`/api/users/${id}/reject`, { method: "PUT" });
      if (!res.ok) throw new Error("Failed to reject user");
      return res.json();
    },
    // Change role (SuperAdmin only) – persisted to DB
    changeRole: async (id: string, newRole: UserRole) => {
      const res = await fetch("/api/users/role", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId: id, newRole }),
      });
      if (!res.ok) throw new Error("Failed to change role");
      const data = await res.json();
      return { success: true, id: data.userId || id, role: newRole };
    },
    // Get crew members (superadmin + core_member roles) for "The Crew" section
    getCrew: async () => {
      const res = await fetch("/api/crew");
      if (!res.ok) return { crew: [] };
      const data = await res.json();
      // Enrich with local avatar cache as fallback
      for (const m of (data.crew || [])) {
        if (!m.avatarUrl && m.linkedRiderId) {
          const localAvatar = api.avatars.get(m.linkedRiderId);
          if (localAvatar) m.avatarUrl = localAvatar;
        }
      }
      return data;
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
      // Fetch all stats from DB APIs in parallel
      const [ridesRes, blogsData, postsRes, usersRes] = await Promise.all([
        fetch("/api/rides"),
        fetchBlogs(),
        fetch("/api/ride-posts?status=pending").catch(() => null),
        fetch("/api/users").catch(() => null),
      ]);
      const ridesData = ridesRes.ok ? await ridesRes.json() : { rides: [] };
      const allRides = (ridesData.rides || []) as Ride[];
      const pendingBlogs = blogsData.filter((b) => b.approvalStatus === "pending");
      let pendingPostsCount = 0;
      if (postsRes?.ok) {
        const pd = await postsRes.json();
        pendingPostsCount = (pd.posts || []).length;
      }
      let totalUsers = 0;
      let pendingUsers = 0;
      if (usersRes?.ok) {
        const ud = await usersRes.json();
        totalUsers = ud.totalUsers || 0;
        pendingUsers = ud.pendingUsers || 0;
      }
      return {
        stats: {
          totalUsers,
          pendingUsers,
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
