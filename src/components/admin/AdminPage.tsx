"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Shield,
  Users,
  Bike,
  FileText,
  UserPlus,
  UserCheck,
  UserX,
  Trash2,
  Edit3,
  Plus,
  CheckCircle,
  XCircle,
  AlertTriangle,
  BarChart3,
  TrendingUp,
  Eye,
  Lock,
  Copyright,
  Loader2,
  BookOpen,
  ChevronDown,
  ArrowUpDown,
  Search,
  Mail,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api-client";
import type { UserRole } from "@/types";

type AdminTab = "dashboard" | "users" | "rides" | "content" | "approvals";

type PendingUser = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  city?: string | null;
  ridingExperience?: string | null;
  motorcycles: Array<{ make: string; model: string }>;
  createdAt: string;
};

type AllUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  isApproved: boolean;
  joinDate: string;
};

type AdminRide = {
  id: string;
  title: string;
  rideNumber: string;
  status: string;
  startLocation: string;
  endLocation: string;
  distanceKm: number;
  registeredRiders: number;
};

type ContentItem = {
  id: string;
  title: string;
  type: string;
  status: string;
  lastUpdated: string;
};

type AdminStats = {
  totalUsers: number;
  pendingUsers: number;
  activeRides: number;
  totalContent: number;
  pendingBlogs?: number;
  pendingPosts?: number;
};

type PendingBlog = {
  id: string;
  title: string;
  author: string;
  publishDate: string;
  approvalStatus: string;
};

type PendingPost = {
  id: string;
  rideId: string;
  authorName: string;
  content: string;
  createdAt: string;
  approvalStatus: string;
};

const ROLE_LABELS: Record<string, string> = {
  superadmin: "Super Admin",
  core_member: "Core Member",
  t2w_rider: "T2W Rider",
  rider: "Rider",
};

const ROLE_COLORS: Record<string, string> = {
  superadmin: "bg-red-400/10 text-red-400",
  core_member: "bg-t2w-accent/10 text-t2w-accent",
  t2w_rider: "bg-green-400/10 text-green-400",
  rider: "bg-t2w-surface-light text-t2w-muted",
};

export function AdminPage() {
  const { user, loading: authLoading, isSuperAdmin, isCoreOrAbove, canManageRoles, canDeleteRide, canCreateRide, canApproveContent } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [allUsers, setAllUsers] = useState<AllUser[]>([]);
  const [rides, setRides] = useState<AdminRide[]>([]);
  const [content, setContent] = useState<ContentItem[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [showAddRide, setShowAddRide] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingBlogs, setPendingBlogs] = useState<PendingBlog[]>([]);
  const [pendingPosts, setPendingPosts] = useState<PendingPost[]>([]);
  const [roleChangeUser, setRoleChangeUser] = useState<string | null>(null);
  // User management state
  const [userSearch, setUserSearch] = useState("");
  const [userSort, setUserSort] = useState<"name" | "email" | "role" | "joined">("name");
  const [userSortDir, setUserSortDir] = useState<"asc" | "desc">("asc");
  const [deletingUsers, setDeletingUsers] = useState(false);

  const [rideForm, setRideForm] = useState({
    title: "", rideNumber: "", type: "day", startDate: "", endDate: "",
    startLocation: "", endLocation: "", distanceKm: "", maxRiders: "20",
    fee: "0", difficulty: "easy", description: "",
  });
  const [publishingRide, setPublishingRide] = useState(false);

  useEffect(() => {
    if (!user || !isCoreOrAbove) return;

    Promise.all([
      api.admin.stats().catch(() => null),
      api.users.list("status=pending").catch(() => null),
      api.users.list("status=active").catch(() => null),
      api.rides.list().catch(() => null),
      api.admin.content.list().catch(() => null),
      api.blogs.listPending().catch(() => null),
      api.ridePosts.listPending().catch(() => null),
    ])
      .then(([statsData, pendingData, usersData, ridesData, contentData, blogsData, postsData]) => {
        if (statsData) setStats((statsData as { stats: AdminStats }).stats);
        if (pendingData) setPendingUsers((pendingData as { users: PendingUser[] }).users);
        if (usersData) setAllUsers((usersData as { users: AllUser[] }).users);
        if (ridesData) setRides((ridesData as { rides: AdminRide[] }).rides);
        if (contentData) setContent((contentData as { content: ContentItem[] }).content);
        if (blogsData) setPendingBlogs((blogsData as { blogs: PendingBlog[] }).blogs);
        if (postsData) setPendingPosts((postsData as { posts: PendingPost[] }).posts);
      })
      .finally(() => setLoading(false));
  }, [user, isCoreOrAbove]);

  const approveUser = async (id: string) => {
    try {
      await api.users.approve(id);
      setPendingUsers((prev) => prev.filter((u) => u.id !== id));
      if (stats) setStats({ ...stats, pendingUsers: stats.pendingUsers - 1 });
    } catch (err) {
      console.error("Failed to approve user:", err);
    }
  };

  const rejectUser = async (id: string) => {
    try {
      await api.users.reject(id);
      setPendingUsers((prev) => prev.filter((u) => u.id !== id));
      if (stats) setStats({ ...stats, pendingUsers: stats.pendingUsers - 1, totalUsers: stats.totalUsers - 1 });
    } catch (err) {
      console.error("Failed to reject user:", err);
    }
  };

  const deleteRide = async (id: string) => {
    if (!canDeleteRide) return;
    try {
      await api.rides.delete(id);
      setRides((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error("Failed to delete ride:", err);
    }
  };

  const changeUserRole = async (userId: string, newRole: UserRole) => {
    if (!canManageRoles) return;
    try {
      await api.users.changeRole(userId, newRole);
      setAllUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
      setRoleChangeUser(null);
    } catch (err) {
      console.error("Failed to change role:", err);
    }
  };

  // Sorted and filtered users
  const sortedUsers = useMemo(() => {
    let filtered = allUsers;
    if (userSearch.trim()) {
      const q = userSearch.toLowerCase().trim();
      filtered = filtered.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (ROLE_LABELS[u.role] || u.role).toLowerCase().includes(q)
      );
    }
    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (userSort) {
        case "name": cmp = a.name.localeCompare(b.name); break;
        case "email": cmp = a.email.localeCompare(b.email); break;
        case "role": cmp = (ROLE_LABELS[a.role] || a.role).localeCompare(ROLE_LABELS[b.role] || b.role); break;
        case "joined": cmp = a.joinDate.localeCompare(b.joinDate); break;
      }
      return userSortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [allUsers, userSearch, userSort, userSortDir]);

  const nonGmailUsers = useMemo(() => {
    return allUsers.filter(
      (u) => !u.email.toLowerCase().endsWith("@gmail.com") && u.role !== "superadmin" && u.role !== "core_member"
    );
  }, [allUsers]);

  const handleSort = (col: "name" | "email" | "role" | "joined") => {
    if (userSort === col) {
      setUserSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setUserSort(col);
      setUserSortDir("asc");
    }
  };

  const deleteUser = async (id: string, name: string) => {
    if (!confirm(`Delete user "${name}"? This cannot be undone.`)) return;
    try {
      await api.users.delete(id);
      setAllUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (err) {
      console.error("Failed to delete user:", err);
    }
  };

  const deleteNonGmailUsers = async () => {
    if (nonGmailUsers.length === 0) return;
    if (!confirm(`Delete ${nonGmailUsers.length} users with non-Gmail email addresses? Super Admins and Core Members will NOT be deleted. This cannot be undone.`)) return;
    setDeletingUsers(true);
    try {
      const ids = nonGmailUsers.map((u) => u.id);
      await api.users.bulkDelete(ids);
      setAllUsers((prev) => prev.filter((u) => !ids.includes(u.id)));
    } catch (err) {
      console.error("Failed to bulk delete users:", err);
    } finally {
      setDeletingUsers(false);
    }
  };

  const publishRide = async () => {
    if (!canCreateRide || publishingRide) return;
    setPublishingRide(true);
    try {
      const result = await api.rides.create({
        title: rideForm.title,
        rideNumber: rideForm.rideNumber,
        type: rideForm.type,
        status: "upcoming",
        startDate: rideForm.startDate,
        endDate: rideForm.endDate || rideForm.startDate,
        startLocation: rideForm.startLocation,
        endLocation: rideForm.endLocation,
        distanceKm: Number(rideForm.distanceKm) || 0,
        maxRiders: Number(rideForm.maxRiders) || 20,
        registeredRiders: 0,
        fee: Number(rideForm.fee) || 0,
        difficulty: rideForm.difficulty,
        description: rideForm.description,
        route: [rideForm.startLocation, rideForm.endLocation],
        highlights: [],
      });
      const newRide = (result as { ride: AdminRide }).ride;
      setRides((prev) => [newRide, ...prev]);
      setShowAddRide(false);
      setRideForm({ title: "", rideNumber: "", type: "day", startDate: "", endDate: "", startLocation: "", endLocation: "", distanceKm: "", maxRiders: "20", fee: "0", difficulty: "easy", description: "" });
    } catch (err) {
      console.error("Failed to create ride:", err);
    } finally {
      setPublishingRide(false);
    }
  };

  const deleteContent = async (id: string) => {
    try {
      await api.admin.content.delete(id);
      setContent((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      console.error("Failed to delete content:", err);
    }
  };

  const approveBlog = async (id: string) => {
    if (!user) return;
    await api.blogs.approve(id, user.id);
    setPendingBlogs((prev) => prev.filter((b) => b.id !== id));
  };

  const rejectBlog = async (id: string) => {
    if (!user) return;
    await api.blogs.reject(id, user.id);
    setPendingBlogs((prev) => prev.filter((b) => b.id !== id));
  };

  const approvePost = async (id: string) => {
    if (!user) return;
    await api.ridePosts.approve(id, user.id);
    setPendingPosts((prev) => prev.filter((p) => p.id !== id));
  };

  const rejectPost = async (id: string) => {
    if (!user) return;
    await api.ridePosts.reject(id, user.id);
    setPendingPosts((prev) => prev.filter((p) => p.id !== id));
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center pt-24">
        <Loader2 className="h-8 w-8 animate-spin text-t2w-accent" />
      </div>
    );
  }

  if (!user || !isCoreOrAbove) {
    return (
      <div className="flex min-h-screen items-center justify-center pt-24">
        <div className="text-center">
          <Shield className="mx-auto h-16 w-16 text-t2w-border" />
          <h2 className="mt-4 font-display text-2xl font-bold text-white">Access Denied</h2>
          <p className="mt-2 text-t2w-muted">You need Core Member or Super Admin privileges to access this page.</p>
          <Link href="/" className="btn-primary mt-6 inline-block">Go Home</Link>
        </div>
      </div>
    );
  }

  const tabs = [
    { key: "dashboard" as const, label: "Dashboard", icon: BarChart3 },
    ...(isSuperAdmin
      ? [{ key: "users" as const, label: "Users", icon: Users }]
      : []),
    { key: "rides" as const, label: "Rides", icon: Bike },
    { key: "approvals" as const, label: "Approvals", icon: BookOpen, badge: pendingBlogs.length + pendingPosts.length },
    { key: "content" as const, label: "Content", icon: Copyright },
  ];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center pt-24">
        <Loader2 className="h-8 w-8 animate-spin text-t2w-accent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-t2w-accent/10">
            <Shield className="h-6 w-6 text-t2w-accent" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-bold text-white">Admin Panel</h1>
            <p className="text-sm text-t2w-muted">Manage users, rides, and content</p>
          </div>
          <div className="ml-auto flex items-center gap-2 rounded-lg bg-t2w-accent/10 px-3 py-1.5 text-sm text-t2w-accent">
            <Lock className="h-3.5 w-3.5" />
            {ROLE_LABELS[user.role] || user.role}
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-8 flex gap-2 border-b border-t2w-border pb-4 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium whitespace-nowrap transition-all ${
                  activeTab === tab.key
                    ? "bg-t2w-accent text-white"
                    : "text-t2w-muted hover:bg-t2w-surface hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
                {"badge" in tab && (tab.badge ?? 0) > 0 && (
                  <span className="ml-1 rounded-full bg-yellow-400 px-1.5 py-0.5 text-xs font-bold text-black">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Dashboard Tab */}
        {activeTab === "dashboard" && stats && (
          <div>
            <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
              {[
                { label: "Total Users", value: String(stats.totalUsers), change: "Registered users", icon: Users, color: "text-blue-400" },
                { label: "Pending Approvals", value: String(stats.pendingUsers), change: "Awaiting review", icon: UserPlus, color: "text-yellow-400" },
                { label: "Active Rides", value: String(stats.activeRides), change: "Upcoming scheduled", icon: Bike, color: "text-green-400" },
                { label: "Pending Content", value: String((stats.pendingBlogs || 0) + (stats.pendingPosts || 0)), change: "Blogs & posts awaiting review", icon: BookOpen, color: "text-purple-400" },
              ].map(({ label, value, change, icon: Icon, color }) => (
                <div key={label} className="card">
                  <div className="flex items-center justify-between">
                    <Icon className={`h-5 w-5 ${color}`} />
                    <TrendingUp className="h-4 w-4 text-green-400" />
                  </div>
                  <div className="mt-3 font-display text-3xl font-bold text-white">{value}</div>
                  <p className="mt-1 text-xs text-t2w-muted">{label}</p>
                  <p className="mt-0.5 text-xs text-t2w-muted">{change}</p>
                </div>
              ))}
            </div>

            {pendingUsers.length > 0 && (
              <div className="card">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 font-display text-lg font-bold text-white">
                    <AlertTriangle className="h-5 w-5 text-yellow-400" />
                    Pending User Approvals ({pendingUsers.length})
                  </h3>
                  {isSuperAdmin && (
                    <button onClick={() => setActiveTab("users")} className="text-sm text-t2w-accent hover:text-t2w-accent/80">
                      View All &rarr;
                    </button>
                  )}
                </div>
                <div className="space-y-3">
                  {pendingUsers.slice(0, 3).map((u) => (
                    <div key={u.id} className="flex items-center gap-4 rounded-xl bg-t2w-surface-light p-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-400/10 font-display text-sm font-bold text-yellow-400">
                        {u.name.split(" ").map((n) => n[0]).join("")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white">{u.name}</p>
                        <p className="text-xs text-t2w-muted">
                          {u.city || "N/A"} &middot; {u.ridingExperience || "N/A"}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => approveUser(u.id)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-400/10 text-green-400 transition-colors hover:bg-green-400/20" title="Approve">
                          <CheckCircle className="h-4 w-4" />
                        </button>
                        <button onClick={() => rejectUser(u.id)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-400/10 text-red-400 transition-colors hover:bg-red-400/20" title="Reject">
                          <XCircle className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Users Tab - SuperAdmin only */}
        {activeTab === "users" && isSuperAdmin && (
          <div className="space-y-8">
            {pendingUsers.length > 0 && (
              <div className="card">
                <h3 className="mb-6 flex items-center gap-2 font-display text-xl font-bold text-white">
                  <UserPlus className="h-5 w-5 text-yellow-400" />
                  Pending Registrations ({pendingUsers.length})
                </h3>
                <div className="space-y-4">
                  {pendingUsers.map((u) => (
                    <div key={u.id} className="rounded-xl border border-yellow-400/20 bg-yellow-400/5 p-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-yellow-400/10 font-display text-lg font-bold text-yellow-400">
                          {u.name.split(" ").map((n) => n[0]).join("")}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-white">{u.name}</h4>
                          <p className="text-sm text-t2w-muted">{u.email} &middot; {u.phone || "No phone"}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <span className="rounded-md bg-t2w-surface px-2 py-0.5 text-xs text-t2w-muted">{u.city || "N/A"}</span>
                            <span className="rounded-md bg-t2w-surface px-2 py-0.5 text-xs text-t2w-muted">{u.ridingExperience || "N/A"}</span>
                          </div>
                        </div>
                        <div className="flex gap-2 sm:flex-col">
                          <button onClick={() => approveUser(u.id)} className="flex items-center gap-1.5 rounded-lg bg-green-400/10 px-4 py-2 text-sm font-medium text-green-400 transition-colors hover:bg-green-400/20">
                            <UserCheck className="h-4 w-4" />
                            Approve
                          </button>
                          <button onClick={() => rejectUser(u.id)} className="flex items-center gap-1.5 rounded-lg bg-red-400/10 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-400/20">
                            <UserX className="h-4 w-4" />
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="card">
              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="font-display text-xl font-bold text-white">
                  All Users ({allUsers.length})
                </h3>
                <div className="flex flex-wrap items-center gap-3">
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-t2w-muted" />
                    <input
                      type="text"
                      placeholder="Search users..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="input-field !py-2 !pl-9 !pr-3 text-xs w-48"
                    />
                  </div>
                  {/* Bulk delete non-Gmail */}
                  {nonGmailUsers.length > 0 && (
                    <button
                      onClick={deleteNonGmailUsers}
                      disabled={deletingUsers}
                      className="flex items-center gap-1.5 rounded-lg bg-red-400/10 px-3 py-2 text-xs font-medium text-red-400 transition-colors hover:bg-red-400/20"
                      title="Delete all users without @gmail.com email (excludes Super Admins and Core Members)"
                    >
                      {deletingUsers ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                      Delete Non-Gmail ({nonGmailUsers.length})
                    </button>
                  )}
                </div>
              </div>
              <div className="mb-2 text-xs text-t2w-muted">
                Showing {sortedUsers.length} of {allUsers.length} users
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-t2w-border">
                      {([
                        { key: "name" as const, label: "User" },
                        { key: "email" as const, label: "Email" },
                        { key: "role" as const, label: "Role" },
                      ]).map((col) => (
                        <th key={col.key} className="pb-3 text-left text-xs font-semibold uppercase tracking-wider text-t2w-muted">
                          <button onClick={() => handleSort(col.key)} className="flex items-center gap-1 hover:text-white transition-colors">
                            {col.label}
                            <ArrowUpDown className={`h-3 w-3 ${userSort === col.key ? "text-t2w-accent" : ""}`} />
                          </button>
                        </th>
                      ))}
                      <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wider text-t2w-muted">Status</th>
                      <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wider text-t2w-muted">
                        <button onClick={() => handleSort("joined")} className="flex items-center gap-1 hover:text-white transition-colors">
                          Joined
                          <ArrowUpDown className={`h-3 w-3 ${userSort === "joined" ? "text-t2w-accent" : ""}`} />
                        </button>
                      </th>
                      <th className="pb-3 text-right text-xs font-semibold uppercase tracking-wider text-t2w-muted">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-t2w-border">
                    {sortedUsers.map((u) => (
                      <tr key={u.id} className="transition-colors hover:bg-t2w-surface-light/50">
                        <td className="py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-t2w-accent/10 text-xs font-bold text-t2w-accent">
                              {u.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                            </div>
                            <span className="font-medium text-white text-sm truncate max-w-[150px]">{u.name}</span>
                          </div>
                        </td>
                        <td className="py-3 text-xs text-t2w-muted truncate max-w-[200px]">{u.email}</td>
                        <td className="py-3">
                          {roleChangeUser === u.id ? (
                            <div className="flex items-center gap-1">
                              <select
                                defaultValue={u.role}
                                onChange={(e) =>
                                  changeUserRole(u.id, e.target.value as UserRole)
                                }
                                className="rounded-lg bg-t2w-surface-light px-2 py-1 text-xs text-white border border-t2w-border cursor-pointer"
                              >
                                <option value="superadmin">Super Admin</option>
                                <option value="core_member">Core Member</option>
                                <option value="t2w_rider">T2W Rider</option>
                                <option value="rider">Rider</option>
                              </select>
                              <button
                                onClick={() => setRoleChangeUser(null)}
                                className="text-t2w-muted hover:text-white"
                              >
                                <XCircle className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span
                              className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                                ROLE_COLORS[u.role] || "bg-t2w-surface-light text-t2w-muted"
                              }`}
                            >
                              {ROLE_LABELS[u.role] || u.role}
                            </span>
                          )}
                        </td>
                        <td className="py-3">
                          <span className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                            u.isApproved ? "bg-green-400/10 text-green-400" : "bg-yellow-400/10 text-yellow-400"
                          }`}>
                            {u.isApproved ? "active" : "pending"}
                          </span>
                        </td>
                        <td className="py-3 text-xs text-t2w-muted">
                          {new Date(u.joinDate).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {canManageRoles && u.role !== "superadmin" && (
                              <button
                                onClick={() => setRoleChangeUser(u.id)}
                                className="flex h-7 w-7 items-center justify-center rounded-lg text-t2w-muted hover:bg-t2w-surface-light hover:text-white transition-colors"
                                title="Change Role"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {u.role !== "superadmin" && (
                              <button
                                onClick={() => deleteUser(u.id, u.name)}
                                className="flex h-7 w-7 items-center justify-center rounded-lg text-t2w-muted hover:bg-red-400/10 hover:text-red-400 transition-colors"
                                title="Delete User"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Rides Tab */}
        {activeTab === "rides" && (
          <div>
            <div className="mb-6 flex items-center justify-between">
              <h3 className="font-display text-xl font-bold text-white">Manage Rides</h3>
              {canCreateRide && (
                <button onClick={() => setShowAddRide(!showAddRide)} className="btn-primary flex items-center gap-2 !px-4 !py-2.5 text-sm">
                  <Plus className="h-4 w-4" />
                  Add New Ride
                </button>
              )}
            </div>

            {showAddRide && canCreateRide && (
              <div className="card mb-8">
                <h3 className="mb-6 font-display text-lg font-bold text-white">Create New Ride</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2"><label className="mb-1.5 block text-sm font-medium text-gray-300">Ride Title</label><input type="text" className="input-field" placeholder="e.g., Coastal Sunrise Sprint" value={rideForm.title} onChange={(e) => setRideForm({ ...rideForm, title: e.target.value })} /></div>
                  <div><label className="mb-1.5 block text-sm font-medium text-gray-300">Ride Number</label><input type="text" className="input-field" placeholder="#029" value={rideForm.rideNumber} onChange={(e) => setRideForm({ ...rideForm, rideNumber: e.target.value })} /></div>
                  <div><label className="mb-1.5 block text-sm font-medium text-gray-300">Type</label><select className="input-field cursor-pointer" value={rideForm.type} onChange={(e) => setRideForm({ ...rideForm, type: e.target.value })}><option value="day">Day Ride</option><option value="weekend">Weekend</option><option value="multi-day">Multi-Day</option><option value="expedition">Expedition</option></select></div>
                  <div><label className="mb-1.5 block text-sm font-medium text-gray-300">Start Date</label><input type="date" className="input-field" value={rideForm.startDate} onChange={(e) => setRideForm({ ...rideForm, startDate: e.target.value })} /></div>
                  <div><label className="mb-1.5 block text-sm font-medium text-gray-300">End Date</label><input type="date" className="input-field" value={rideForm.endDate} onChange={(e) => setRideForm({ ...rideForm, endDate: e.target.value })} /></div>
                  <div><label className="mb-1.5 block text-sm font-medium text-gray-300">Start Location</label><input type="text" className="input-field" placeholder="Starting point" value={rideForm.startLocation} onChange={(e) => setRideForm({ ...rideForm, startLocation: e.target.value })} /></div>
                  <div><label className="mb-1.5 block text-sm font-medium text-gray-300">End Location</label><input type="text" className="input-field" placeholder="Destination" value={rideForm.endLocation} onChange={(e) => setRideForm({ ...rideForm, endLocation: e.target.value })} /></div>
                  <div><label className="mb-1.5 block text-sm font-medium text-gray-300">Distance (km)</label><input type="number" className="input-field" placeholder="0" value={rideForm.distanceKm} onChange={(e) => setRideForm({ ...rideForm, distanceKm: e.target.value })} /></div>
                  <div><label className="mb-1.5 block text-sm font-medium text-gray-300">Max Riders</label><input type="number" className="input-field" placeholder="20" value={rideForm.maxRiders} onChange={(e) => setRideForm({ ...rideForm, maxRiders: e.target.value })} /></div>
                  <div><label className="mb-1.5 block text-sm font-medium text-gray-300">Registration Fee</label><input type="number" className="input-field" placeholder="0" value={rideForm.fee} onChange={(e) => setRideForm({ ...rideForm, fee: e.target.value })} /></div>
                  <div><label className="mb-1.5 block text-sm font-medium text-gray-300">Difficulty</label><select className="input-field cursor-pointer" value={rideForm.difficulty} onChange={(e) => setRideForm({ ...rideForm, difficulty: e.target.value })}><option value="easy">Easy</option><option value="moderate">Moderate</option><option value="challenging">Challenging</option><option value="extreme">Extreme</option></select></div>
                  <div className="sm:col-span-2"><label className="mb-1.5 block text-sm font-medium text-gray-300">Description</label><textarea rows={3} className="input-field resize-none" placeholder="Describe the ride..." value={rideForm.description} onChange={(e) => setRideForm({ ...rideForm, description: e.target.value })} /></div>
                  <div className="sm:col-span-2 flex gap-3">
                    <button type="button" className="btn-primary flex items-center gap-2" onClick={publishRide} disabled={publishingRide || !rideForm.title || !rideForm.startDate}>
                      {publishingRide ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      {publishingRide ? "Publishing..." : "Publish Ride"}
                    </button>
                    <button type="button" className="btn-secondary" onClick={() => setShowAddRide(false)}>Cancel</button>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {rides.map((ride) => (
                <div key={ride.id} className="card flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-white truncate">{ride.title}</h4>
                      <span className={`shrink-0 rounded-lg px-2 py-0.5 text-xs font-medium capitalize ${
                        ride.status === "upcoming" ? "bg-blue-400/10 text-blue-400" : ride.status === "completed" ? "bg-green-400/10 text-green-400" : "bg-gray-400/10 text-gray-400"
                      }`}>{ride.status}</span>
                    </div>
                    <p className="mt-1 text-sm text-t2w-muted">
                      {ride.rideNumber} &middot; {ride.startLocation} &rarr; {ride.endLocation} &middot; {ride.distanceKm} km &middot; {ride.registeredRiders} registered
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/ride?id=${ride.id}`} className="flex items-center gap-1.5 rounded-lg bg-t2w-surface-light px-3 py-2 text-xs text-t2w-muted transition-colors hover:text-white">
                      <Eye className="h-3.5 w-3.5" />View
                    </Link>
                    {canDeleteRide && (
                      <button onClick={() => deleteRide(ride.id)} className="flex items-center gap-1.5 rounded-lg bg-red-400/10 px-3 py-2 text-xs text-red-400 transition-colors hover:bg-red-400/20">
                        <Trash2 className="h-3.5 w-3.5" />Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Approvals Tab */}
        {activeTab === "approvals" && canApproveContent && (
          <div className="space-y-8">
            {/* Pending Blogs */}
            <div className="card">
              <h3 className="mb-6 flex items-center gap-2 font-display text-xl font-bold text-white">
                <BookOpen className="h-5 w-5 text-yellow-400" />
                Pending Blogs ({pendingBlogs.length})
              </h3>
              {pendingBlogs.length === 0 ? (
                <p className="py-6 text-center text-t2w-muted">No pending blogs to review.</p>
              ) : (
                <div className="space-y-3">
                  {pendingBlogs.map((blog) => (
                    <div key={blog.id} className="flex flex-col gap-3 sm:flex-row sm:items-center rounded-xl bg-t2w-surface-light p-4">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-white truncate">{blog.title}</h4>
                        <p className="text-xs text-t2w-muted mt-1">
                          By {blog.author} &middot;{" "}
                          {new Date(blog.publishDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => approveBlog(blog.id)} className="flex items-center gap-1.5 rounded-lg bg-green-400/10 px-3 py-2 text-xs font-medium text-green-400 hover:bg-green-400/20">
                          <CheckCircle className="h-3.5 w-3.5" />
                          Approve
                        </button>
                        <button onClick={() => rejectBlog(blog.id)} className="flex items-center gap-1.5 rounded-lg bg-red-400/10 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-400/20">
                          <XCircle className="h-3.5 w-3.5" />
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pending Ride Posts */}
            <div className="card">
              <h3 className="mb-6 flex items-center gap-2 font-display text-xl font-bold text-white">
                <FileText className="h-5 w-5 text-yellow-400" />
                Pending Ride Posts ({pendingPosts.length})
              </h3>
              {pendingPosts.length === 0 ? (
                <p className="py-6 text-center text-t2w-muted">No pending ride posts to review.</p>
              ) : (
                <div className="space-y-3">
                  {pendingPosts.map((post) => (
                    <div key={post.id} className="rounded-xl bg-t2w-surface-light p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-t2w-muted mb-1">
                            By {post.authorName} &middot; Ride: {post.rideId}
                          </p>
                          <p className="text-sm text-gray-300 line-clamp-3">
                            {post.content}
                          </p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button onClick={() => approvePost(post.id)} className="flex items-center gap-1.5 rounded-lg bg-green-400/10 px-3 py-2 text-xs font-medium text-green-400 hover:bg-green-400/20">
                            <CheckCircle className="h-3.5 w-3.5" />
                            Approve
                          </button>
                          <button onClick={() => rejectPost(post.id)} className="flex items-center gap-1.5 rounded-lg bg-red-400/10 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-400/20">
                            <XCircle className="h-3.5 w-3.5" />
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Content Tab */}
        {activeTab === "content" && (
          <div>
            <div className="mb-6 flex items-center justify-between">
              <h3 className="font-display text-xl font-bold text-white">Copyrighted Content</h3>
            </div>
            <div className="space-y-3">
              {content.map((item) => (
                <div key={item.id} className="card flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-400/10">
                    <Copyright className="h-5 w-5 text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-white">{item.title}</h4>
                    <p className="mt-0.5 text-sm text-t2w-muted">
                      {item.type} &middot; Last updated {new Date(item.lastUpdated).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <span className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                    item.status === "published" ? "bg-green-400/10 text-green-400" : "bg-yellow-400/10 text-yellow-400"
                  }`}>{item.status}</span>
                  <div className="flex gap-2">
                    {isSuperAdmin && (
                      <button onClick={() => deleteContent(item.id)} className="flex items-center gap-1.5 rounded-lg bg-red-400/10 px-3 py-2 text-xs text-red-400 transition-colors hover:bg-red-400/20"><Trash2 className="h-3.5 w-3.5" />Delete</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
