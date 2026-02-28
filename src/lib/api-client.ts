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
  riderProfiles,
  riderNameToId,
  type RiderProfile,
} from "@/data/rider-profiles";
import type { Ride, BlogPost, User, UserRole, RidePost, BlogApprovalStatus, RideRegistration } from "@/types";

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

// ── Storage keys ──
const AUTH_KEY = "t2w_auth";
const USERS_KEY = "t2w_users";
const PASSWORDS_KEY = "t2w_passwords"; // email -> password overrides
const RIDE_REG_KEY = "t2w_ride_registrations";
const NOTIF_KEY = "t2w_notif_read";
const BLOGS_KEY = "t2w_blogs";
const RIDE_POSTS_KEY = "t2w_ride_posts";
const RIDES_KEY = "t2w_custom_rides";

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

// ── Find rider profile by email match ──
function findRiderByEmail(email: string): RiderProfile | undefined {
  const lowerEmail = email.toLowerCase().trim();
  return riderProfiles.find((r) => r.email.toLowerCase().trim() === lowerEmail);
}

// ── Determine role based on rider participation ──
function determineRoleForRider(rider: RiderProfile | undefined): UserRole {
  if (rider && rider.ridesCompleted > 0) return "t2w_rider";
  return "rider";
}

// ── Built-in seed users (super admins + core members) ──
function getBuiltinUsers(): StoredUser[] {
  return [
    {
      id: "admin-1",
      name: "Roshan Manuel",
      email: "roshan.manuel@gmail.com",
      password: "admin123",
      phone: "+91 9880141543",
      city: "Bangalore",
      ridingExperience: "veteran",
      motorcycle: "",
      role: "superadmin",
      joinDate: "2024-03-16",
      isApproved: true,
      linkedRiderId: riderProfiles.find((r) => r.email.toLowerCase() === "roshan.manuel@gmail.com")?.id,
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
    {
      id: "admin-2",
      name: "Sanjeev Kumar",
      email: "san.nh007@gmail.com",
      password: "core123",
      phone: "",
      city: "Bangalore",
      ridingExperience: "veteran",
      motorcycle: "",
      role: "core_member",
      joinDate: "2024-03-16",
      isApproved: true,
      linkedRiderId: riderProfiles.find((r) => r.email.toLowerCase() === "san.nh007@gmail.com")?.id,
    },
    {
      id: "admin-3",
      name: "Jay Trivedi",
      email: "jaytrivedi.b@gmail.com",
      password: "core123",
      phone: "9986160300",
      city: "Bangalore",
      ridingExperience: "veteran",
      motorcycle: "",
      role: "core_member",
      joinDate: "2024-03-16",
      isApproved: true,
      linkedRiderId: riderProfiles.find((r) => r.email.toLowerCase() === "jaytrivedi.b@gmail.com")?.id,
    },
    {
      id: "admin-4",
      name: "Shreyas BM",
      email: "shreyasbm77@gmail.com",
      password: "core123",
      phone: "",
      city: "Bangalore",
      ridingExperience: "veteran",
      motorcycle: "",
      role: "core_member",
      joinDate: "2024-03-16",
      isApproved: true,
      linkedRiderId: riderProfiles.find((r) => r.email.toLowerCase() === "shreyasbm77@gmail.com")?.id,
    },
    {
      id: "admin-5",
      name: "Harish Mysuru",
      email: "harishkumarmr27@gmail.com",
      password: "core123",
      phone: "",
      city: "Bangalore",
      ridingExperience: "veteran",
      motorcycle: "",
      role: "core_member",
      joinDate: "2024-03-16",
      isApproved: true,
      linkedRiderId: riderProfiles.find((r) => r.email.toLowerCase() === "harishkumarmr27@gmail.com")?.id,
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
  return [...builtinUsers, ...customUsers];
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
  // Find linked rider profile
  const linkedRider = dbUser.linkedRiderId
    ? riderProfiles.find((r) => r.id === dbUser.linkedRiderId)
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

// ── Custom rides ──
function getCustomRides(): Ride[] {
  return getStorage<Ride[]>(RIDES_KEY, []);
}

function getAllRides(): Ride[] {
  return [...mockRides, ...getCustomRides()];
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
        // Check password overrides first (set via forgot password)
        const override = overrides[emailLower];
        if (override) return password === override;
        // Fallback to stored password
        return u.password === password;
      });
      if (!found) throw new Error("Invalid email or password");
      setStorage(AUTH_KEY, found.id);
      return buildUserData(found);
    },

    // Social / email-only login (Google, Facebook simulation)
    loginByEmail: async (email: string) => {
      await delay(300);
      const users = getRegisteredUsers();
      const emailLower = email.toLowerCase().trim();
      const found = users.find((u) => u.email.toLowerCase() === emailLower);
      if (!found) throw new Error("NO_ACCOUNT");
      setStorage(AUTH_KEY, found.id);
      return buildUserData(found);
    },

    // Forgot password - generates a temp password and returns it
    resetPassword: async (email: string) => {
      await delay(400);
      const users = getRegisteredUsers();
      const emailLower = email.toLowerCase().trim();
      const found = users.find((u) => u.email.toLowerCase() === emailLower);
      if (!found) throw new Error("No account found with this email");
      // Generate a random temporary password
      const tempPassword = "T2W" + Math.random().toString(36).substring(2, 8);
      // Store as override
      const overrides = getStorage<Record<string, string>>(PASSWORDS_KEY, {});
      overrides[emailLower] = tempPassword;
      setStorage(PASSWORDS_KEY, overrides);
      return { success: true, tempPassword };
    },

    // Change password (after reset or voluntarily)
    changePassword: async (email: string, newPassword: string) => {
      await delay(200);
      const emailLower = email.toLowerCase().trim();
      const overrides = getStorage<Record<string, string>>(PASSWORDS_KEY, {});
      overrides[emailLower] = newPassword;
      setStorage(PASSWORDS_KEY, overrides);
      return { success: true };
    },

    register: async (data: Record<string, unknown>) => {
      await delay(400);
      const users = getRegisteredUsers();
      const email = String(data.email || "").toLowerCase().trim();
      if (users.find((u) => u.email.toLowerCase() === email)) {
        throw new Error("An account with this email already exists");
      }

      // Check if this email matches an existing rider profile
      const matchedRider = findRiderByEmail(email);
      const role = determineRoleForRider(matchedRider);

      const newUser: StoredUser = {
        id: `user-${Date.now()}`,
        name: String(data.name || ""),
        email: String(data.email || ""),
        password: String(data.password || ""),
        phone: String(data.phone || ""),
        city: String(data.city || ""),
        ridingExperience: String(data.ridingExperience || ""),
        motorcycle: String(data.motorcycle || ""),
        role,
        joinDate: new Date().toISOString().split("T")[0],
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
      // Merge mockAllUsers with registered users
      const registeredUsers = getRegisteredUsers();
      const combined = mockAllUsers.map((u) => {
        const reg = registeredUsers.find(
          (r) => r.email.toLowerCase() === u.email.toLowerCase()
        );
        return reg ? { ...u, role: reg.role } : u;
      });
      // Add registered users not in mockAllUsers
      const mockEmails = new Set(
        mockAllUsers.map((u) => u.email.toLowerCase())
      );
      registeredUsers
        .filter((r) => !mockEmails.has(r.email.toLowerCase()))
        .forEach((r) => {
          combined.push({
            id: r.id,
            name: r.name,
            email: r.email,
            role: r.role,
            isApproved: r.isApproved,
            joinDate: r.joinDate,
          });
        });
      return { users: combined };
    },
    get: async (id: string) => {
      await delay(100);
      const u = mockAllUsers.find((u) => u.id === id);
      return { user: u || null };
    },
    update: async (id: string, data: Record<string, unknown>) => {
      await delay(200);
      // If role is being updated, persist it
      if (data.role) {
        const users = getRegisteredUsers();
        const user = users.find((u) => u.id === id);
        if (user) {
          user.role = data.role as UserRole;
          saveCustomUsers(users);
        }
      }
      return { user: { id, ...data } };
    },
    delete: async (id: string) => {
      await delay(200);
      return { success: true, id };
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
    // Change role (SuperAdmin only)
    changeRole: async (id: string, newRole: UserRole) => {
      await delay(200);
      const users = getRegisteredUsers();
      const user = users.find((u) => u.id === id);
      if (user) {
        user.role = newRole;
        saveCustomUsers(users);
      }
      return { success: true, id, role: newRole };
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
      return {
        ride: {
          ...ride,
          registrations: regs[id] || [],
          riders: ride.riders || [],
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
        email: String(data?.email || ""),
        phone: String(data?.phone || ""),
        emergencyContactName: String(data?.emergencyContactName || ""),
        emergencyContactPhone: String(data?.emergencyContactPhone || ""),
        bloodGroup: String(data?.bloodGroup || ""),
        vehicleModel: String(data?.vehicleModel || ""),
        vehicleRegNumber: String(data?.vehicleRegNumber || ""),
        agreedIndemnity: Boolean(data?.agreedIndemnity),
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
          totalUsers: mockAllUsers.length + 3,
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

  seed: async () => {
    await delay(100);
    return { success: true, message: "Using client-side mock data" };
  },
};
