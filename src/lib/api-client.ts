import {
  mockRides,
  mockBlogs,
  mockNotifications,
  mockCurrentUser,
  mockGuidelines,
  mockPendingUsers,
  mockAllUsers,
  mockContentItems,
} from "@/data/mock";
import {
  riderProfiles,
  riderNameToId,
  type RiderProfile,
} from "@/data/rider-profiles";
import { Ride, BlogPost, User } from "@/types";

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
}

// ── Auth ──
const AUTH_KEY = "t2w_auth";
const USERS_KEY = "t2w_users";

function getRegisteredUsers(): Array<{
  id: string;
  name: string;
  email: string;
  password: string;
  phone: string;
  city: string;
  ridingExperience: string;
  motorcycle: string;
  role: string;
  joinDate: string;
  isApproved: boolean;
}> {
  return getStorage(USERS_KEY, [
    {
      id: "user-1",
      name: "Rohan Kapoor",
      email: "rohan@example.com",
      password: "password123",
      phone: "+91 98765 43210",
      city: "Mumbai",
      ridingExperience: "veteran",
      motorcycle: "Royal Enfield Himalayan 450",
      role: "rider",
      joinDate: "2024-06-15",
      isApproved: true,
    },
    {
      id: "admin-1",
      name: "Arjun Mehta",
      email: "admin@t2w.com",
      password: "admin123",
      phone: "+91 98765 00001",
      city: "Mumbai",
      ridingExperience: "veteran",
      motorcycle: "BMW R 1250 GS",
      role: "admin",
      joinDate: "2023-01-01",
      isApproved: true,
    },
  ]);
}

function buildUserData(dbUser: ReturnType<typeof getRegisteredUsers>[0]): {
  user: Record<string, unknown>;
} {
  if (dbUser.id === "user-1") {
    return {
      user: {
        ...mockCurrentUser,
        city: dbUser.city,
        ridingExperience: dbUser.ridingExperience,
        earnedBadges: mockCurrentUser.badges.map((b, i) => ({
          id: `ub-${i}`,
          earnedDate: b.earnedDate || "2025-01-01",
          badge: b,
        })),
      },
    };
  }
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
      totalKm: dbUser.role === "admin" ? 25000 : 0,
      ridesCompleted: dbUser.role === "admin" ? 35 : 0,
      motorcycles:
        dbUser.role === "admin"
          ? [
              {
                id: "moto-admin-1",
                make: "BMW",
                model: "R 1250 GS",
                year: 2024,
                cc: 1254,
                color: "Triple Black",
                nickname: "Beast",
              },
            ]
          : [],
      earnedBadges:
        dbUser.role === "admin"
          ? [
              {
                id: "ub-a1",
                earnedDate: "2023-06-01",
                badge: {
                  id: "b-gold",
                  tier: "GOLD",
                  name: "Gold Rider",
                  description: "Completed 5,000 km with T2W",
                  minKm: 5000,
                  icon: "award",
                  color: "#FFD700",
                },
              },
              {
                id: "ub-a2",
                earnedDate: "2024-03-15",
                badge: {
                  id: "b-plat",
                  tier: "PLATINUM",
                  name: "Platinum Rider",
                  description: "Completed 15,000 km with T2W",
                  minKm: 15000,
                  icon: "star",
                  color: "#E5E4E2",
                },
              },
            ]
          : [],
    },
  };
}

// ── Ride registrations ──
const RIDE_REG_KEY = "t2w_ride_registrations";

function getRideRegistrations(): Record<string, string[]> {
  return getStorage(RIDE_REG_KEY, {});
}

// ── Notification state ──
const NOTIF_KEY = "t2w_notif_read";

function getReadNotifs(): string[] {
  return getStorage(NOTIF_KEY, []);
}

// ── API object (same interface as before, but local) ──
export const api = {
  auth: {
    login: async (email: string, password: string) => {
      await delay(300);
      const users = getRegisteredUsers();
      const found = users.find(
        (u) => u.email === email && u.password === password
      );
      if (!found) throw new Error("Invalid email or password");
      setStorage(AUTH_KEY, found.id);
      return buildUserData(found);
    },

    register: async (data: Record<string, unknown>) => {
      await delay(400);
      const users = getRegisteredUsers();
      if (users.find((u) => u.email === data.email)) {
        throw new Error("An account with this email already exists");
      }
      const newUser = {
        id: `user-${Date.now()}`,
        name: String(data.name || ""),
        email: String(data.email || ""),
        password: String(data.password || ""),
        phone: String(data.phone || ""),
        city: String(data.city || ""),
        ridingExperience: String(data.ridingExperience || ""),
        motorcycle: String(data.motorcycle || ""),
        role: "rider",
        joinDate: new Date().toISOString().split("T")[0],
        isApproved: false,
      };
      users.push(newUser);
      setStorage(USERS_KEY, users);
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
      return { users: mockAllUsers };
    },
    get: async (id: string) => {
      await delay(100);
      const u = mockAllUsers.find((u) => u.id === id);
      return { user: u || null };
    },
    update: async (id: string, data: Record<string, unknown>) => {
      await delay(200);
      return { user: { id, ...data } };
    },
    delete: async (id: string) => {
      await delay(200);
      return { success: true, id };
    },
    approve: async (id: string) => {
      await delay(200);
      return { success: true, id };
    },
    reject: async (id: string) => {
      await delay(200);
      return { success: true, id };
    },
  },

  rides: {
    list: async () => {
      await delay(200);
      return { rides: mockRides };
    },
    get: async (id: string) => {
      await delay(150);
      const ride = mockRides.find((r) => r.id === id);
      if (!ride) throw new Error("Ride not found");
      return { ride: { ...ride, registrations: [], riders: ride.riders || [] } };
    },
    create: async (data: Record<string, unknown>) => {
      await delay(300);
      return { ride: { id: `ride-${Date.now()}`, ...data } };
    },
    update: async (id: string, data: Record<string, unknown>) => {
      await delay(200);
      return { ride: { id, ...data } };
    },
    delete: async (id: string) => {
      await delay(200);
      return { success: true, id };
    },
    register: async (id: string, data?: Record<string, unknown>) => {
      await delay(400);
      const regs = getRideRegistrations();
      const userId =
        getStorage<string | null>(AUTH_KEY, null) || "anonymous";
      if (!regs[id]) regs[id] = [];
      if (regs[id].includes(userId)) {
        throw new Error("You are already registered for this ride");
      }
      regs[id].push(userId);
      setStorage(RIDE_REG_KEY, regs);
      const code = `T2W-${id.toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      return { registration: { userId, rideId: id }, confirmationCode: code };
    },
    unregister: async (id: string) => {
      await delay(200);
      return { success: true, id };
    },
  },

  riders: {
    list: async () => {
      await delay(150);
      return { riders: riderProfiles };
    },
    get: async (id: string) => {
      await delay(100);
      const rider = riderProfiles.find((r) => r.id === id);
      if (!rider) throw new Error("Rider not found");
      return { rider };
    },
    getByName: async (name: string) => {
      await delay(50);
      const key = name.toLowerCase().trim();
      const id = riderNameToId[key];
      if (id) {
        const rider = riderProfiles.find((r) => r.id === id);
        return { rider: rider || null, riderId: id };
      }
      return { rider: null, riderId: null };
    },
  },

  blogs: {
    list: async (_params?: string) => {
      await delay(150);
      return { blogs: mockBlogs };
    },
    get: async (id: string) => {
      await delay(100);
      const blog = mockBlogs.find((b) => b.id === id);
      return { blog: blog || null };
    },
    create: async (data: Record<string, unknown>) => {
      await delay(300);
      return { blog: { id: `blog-${Date.now()}`, ...data } };
    },
    update: async (id: string, data: Record<string, unknown>) => {
      await delay(200);
      return { blog: { id, ...data } };
    },
    delete: async (id: string) => {
      await delay(200);
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
      return {
        completedRides: mockRides
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
        upcomingRides: mockRides
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
      return {
        stats: {
          totalUsers: mockAllUsers.length + 3,
          pendingUsers: mockPendingUsers.length,
          activeRides: mockRides.filter((r) => r.status === "upcoming").length,
          totalContent: mockContentItems.length,
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

  seed: async () => {
    await delay(100);
    return { success: true, message: "Using client-side mock data" };
  },
};
