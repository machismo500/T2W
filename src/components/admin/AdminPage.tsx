"use client";

import { useState } from "react";
import {
  Shield,
  Users,
  Bike,
  FileText,
  Settings,
  UserPlus,
  UserCheck,
  UserX,
  Trash2,
  Edit3,
  Plus,
  Search,
  CheckCircle,
  XCircle,
  AlertTriangle,
  BarChart3,
  TrendingUp,
  Calendar,
  Eye,
  MoreVertical,
  ChevronDown,
  Lock,
  Copyright,
} from "lucide-react";
import { mockRides } from "@/data/mock";

type AdminTab = "dashboard" | "users" | "rides" | "content";

const mockPendingUsers = [
  {
    id: "pending-1",
    name: "Amit Kumar",
    email: "amit@example.com",
    phone: "+91 99887 76655",
    city: "Delhi",
    experience: "Intermediate",
    motorcycle: "Bajaj Dominar 400",
    requestDate: "2026-02-22",
  },
  {
    id: "pending-2",
    name: "Sneha Kulkarni",
    email: "sneha@example.com",
    phone: "+91 88776 65544",
    city: "Pune",
    experience: "Beginner",
    motorcycle: "Royal Enfield Classic 350",
    requestDate: "2026-02-23",
  },
  {
    id: "pending-3",
    name: "Rajesh Nair",
    email: "rajesh@example.com",
    phone: "+91 77665 54433",
    city: "Bangalore",
    experience: "Veteran",
    motorcycle: "BMW G 310 GS",
    requestDate: "2026-02-24",
  },
];

const mockAllUsers = [
  {
    id: "user-1",
    name: "Rohan Kapoor",
    email: "rohan@example.com",
    role: "rider",
    status: "active",
    joinDate: "2024-06-15",
  },
  {
    id: "user-2",
    name: "Arjun Mehta",
    email: "arjun@example.com",
    role: "admin",
    status: "active",
    joinDate: "2023-01-10",
  },
  {
    id: "user-3",
    name: "Priya Sharma",
    email: "priya@example.com",
    role: "admin",
    status: "active",
    joinDate: "2023-01-15",
  },
  {
    id: "user-4",
    name: "Vikram Singh",
    email: "vikram@example.com",
    role: "rider",
    status: "active",
    joinDate: "2023-03-20",
  },
  {
    id: "user-5",
    name: "Kiran Patel",
    email: "kiran@example.com",
    role: "rider",
    status: "active",
    joinDate: "2023-06-01",
  },
];

const mockContent = [
  {
    id: "content-1",
    title: "T2W Logo and Brand Assets",
    type: "Brand",
    status: "published",
    lastUpdated: "2025-12-01",
  },
  {
    id: "content-2",
    title: "Official Ride Posters 2026",
    type: "Media",
    status: "published",
    lastUpdated: "2026-01-15",
  },
  {
    id: "content-3",
    title: "Riding Guidelines Document",
    type: "Document",
    status: "published",
    lastUpdated: "2026-02-10",
  },
  {
    id: "content-4",
    title: "T2W Merchandise Catalog",
    type: "Media",
    status: "draft",
    lastUpdated: "2026-02-20",
  },
];

export function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const [pendingUsers, setPendingUsers] = useState(mockPendingUsers);
  const [showAddRide, setShowAddRide] = useState(false);

  const approveUser = (id: string) => {
    setPendingUsers((prev) => prev.filter((u) => u.id !== id));
  };

  const rejectUser = (id: string) => {
    setPendingUsers((prev) => prev.filter((u) => u.id !== id));
  };

  const tabs = [
    { key: "dashboard" as const, label: "Dashboard", icon: BarChart3 },
    { key: "users" as const, label: "Users", icon: Users },
    { key: "rides" as const, label: "Rides", icon: Bike },
    { key: "content" as const, label: "Content", icon: Copyright },
  ];

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-t2w-accent/10">
            <Shield className="h-6 w-6 text-t2w-accent" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-bold text-white">
              Admin Panel
            </h1>
            <p className="text-sm text-t2w-muted">
              Manage users, rides, and content
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2 rounded-lg bg-t2w-accent/10 px-3 py-1.5 text-sm text-t2w-accent">
            <Lock className="h-3.5 w-3.5" />
            Role: Admin
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
              </button>
            );
          })}
        </div>

        {/* Dashboard Tab */}
        {activeTab === "dashboard" && (
          <div>
            {/* Stats */}
            <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
              {[
                {
                  label: "Total Users",
                  value: "523",
                  change: "+12 this month",
                  icon: Users,
                  color: "text-blue-400",
                },
                {
                  label: "Pending Approvals",
                  value: String(pendingUsers.length),
                  change: "Awaiting review",
                  icon: UserPlus,
                  color: "text-yellow-400",
                },
                {
                  label: "Active Rides",
                  value: String(
                    mockRides.filter((r) => r.status === "upcoming").length
                  ),
                  change: "Upcoming scheduled",
                  icon: Bike,
                  color: "text-green-400",
                },
                {
                  label: "Total Content",
                  value: String(mockContent.length),
                  change: "Managed items",
                  icon: FileText,
                  color: "text-purple-400",
                },
              ].map(({ label, value, change, icon: Icon, color }) => (
                <div key={label} className="card">
                  <div className="flex items-center justify-between">
                    <Icon className={`h-5 w-5 ${color}`} />
                    <TrendingUp className="h-4 w-4 text-green-400" />
                  </div>
                  <div className="mt-3 font-display text-3xl font-bold text-white">
                    {value}
                  </div>
                  <p className="mt-1 text-xs text-t2w-muted">{label}</p>
                  <p className="mt-0.5 text-xs text-t2w-muted">{change}</p>
                </div>
              ))}
            </div>

            {/* Pending Approvals Quick View */}
            {pendingUsers.length > 0 && (
              <div className="card">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 font-display text-lg font-bold text-white">
                    <AlertTriangle className="h-5 w-5 text-yellow-400" />
                    Pending User Approvals ({pendingUsers.length})
                  </h3>
                  <button
                    onClick={() => setActiveTab("users")}
                    className="text-sm text-t2w-accent hover:text-t2w-accent/80"
                  >
                    View All →
                  </button>
                </div>
                <div className="space-y-3">
                  {pendingUsers.slice(0, 3).map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center gap-4 rounded-xl bg-t2w-surface-light p-4"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-400/10 font-display text-sm font-bold text-yellow-400">
                        {user.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white">
                          {user.name}
                        </p>
                        <p className="text-xs text-t2w-muted">
                          {user.city} · {user.experience} ·{" "}
                          {user.motorcycle}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => approveUser(user.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-400/10 text-green-400 transition-colors hover:bg-green-400/20"
                          title="Approve"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => rejectUser(user.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-400/10 text-red-400 transition-colors hover:bg-red-400/20"
                          title="Reject"
                        >
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

        {/* Users Tab */}
        {activeTab === "users" && (
          <div className="space-y-8">
            {/* Pending Approvals */}
            {pendingUsers.length > 0 && (
              <div className="card">
                <h3 className="mb-6 flex items-center gap-2 font-display text-xl font-bold text-white">
                  <UserPlus className="h-5 w-5 text-yellow-400" />
                  Pending Registrations ({pendingUsers.length})
                </h3>
                <div className="space-y-4">
                  {pendingUsers.map((user) => (
                    <div
                      key={user.id}
                      className="rounded-xl border border-yellow-400/20 bg-yellow-400/5 p-5"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-yellow-400/10 font-display text-lg font-bold text-yellow-400">
                          {user.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-white">
                            {user.name}
                          </h4>
                          <p className="text-sm text-t2w-muted">
                            {user.email} · {user.phone}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <span className="rounded-md bg-t2w-surface px-2 py-0.5 text-xs text-t2w-muted">
                              {user.city}
                            </span>
                            <span className="rounded-md bg-t2w-surface px-2 py-0.5 text-xs text-t2w-muted">
                              {user.experience}
                            </span>
                            <span className="rounded-md bg-t2w-surface px-2 py-0.5 text-xs text-t2w-muted">
                              {user.motorcycle}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2 sm:flex-col">
                          <button
                            onClick={() => approveUser(user.id)}
                            className="flex items-center gap-1.5 rounded-lg bg-green-400/10 px-4 py-2 text-sm font-medium text-green-400 transition-colors hover:bg-green-400/20"
                          >
                            <UserCheck className="h-4 w-4" />
                            Approve
                          </button>
                          <button
                            onClick={() => rejectUser(user.id)}
                            className="flex items-center gap-1.5 rounded-lg bg-red-400/10 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-400/20"
                          >
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

            {/* All Users */}
            <div className="card">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="font-display text-xl font-bold text-white">
                  All Users
                </h3>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-t2w-muted" />
                  <input
                    type="text"
                    placeholder="Search users..."
                    className="input-field !py-2 !pl-10 w-48"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-t2w-border">
                      <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wider text-t2w-muted">
                        User
                      </th>
                      <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wider text-t2w-muted">
                        Email
                      </th>
                      <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wider text-t2w-muted">
                        Role
                      </th>
                      <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wider text-t2w-muted">
                        Status
                      </th>
                      <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wider text-t2w-muted">
                        Joined
                      </th>
                      <th className="pb-3 text-right text-xs font-semibold uppercase tracking-wider text-t2w-muted">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-t2w-border">
                    {mockAllUsers.map((user) => (
                      <tr
                        key={user.id}
                        className="transition-colors hover:bg-t2w-surface-light/50"
                      >
                        <td className="py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-t2w-accent/10 text-xs font-bold text-t2w-accent">
                              {user.name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")}
                            </div>
                            <span className="font-medium text-white">
                              {user.name}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 text-sm text-t2w-muted">
                          {user.email}
                        </td>
                        <td className="py-4">
                          <select
                            defaultValue={user.role}
                            className="rounded-lg border border-t2w-border bg-t2w-surface px-2 py-1 text-xs text-white cursor-pointer"
                          >
                            <option value="rider">Rider</option>
                            <option value="admin">Admin</option>
                            <option value="superadmin">Super Admin</option>
                          </select>
                        </td>
                        <td className="py-4">
                          <span className="rounded-lg bg-green-400/10 px-2.5 py-1 text-xs font-medium text-green-400">
                            {user.status}
                          </span>
                        </td>
                        <td className="py-4 text-sm text-t2w-muted">
                          {new Date(user.joinDate).toLocaleDateString("en-IN", {
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button className="flex h-7 w-7 items-center justify-center rounded-lg text-t2w-muted hover:bg-t2w-surface-light hover:text-white transition-colors">
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button className="flex h-7 w-7 items-center justify-center rounded-lg text-t2w-muted hover:bg-red-400/10 hover:text-red-400 transition-colors">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
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
              <h3 className="font-display text-xl font-bold text-white">
                Manage Rides
              </h3>
              <button
                onClick={() => setShowAddRide(!showAddRide)}
                className="btn-primary flex items-center gap-2 !px-4 !py-2.5 text-sm"
              >
                <Plus className="h-4 w-4" />
                Add New Ride
              </button>
            </div>

            {/* Add Ride Form */}
            {showAddRide && (
              <div className="card mb-8">
                <h3 className="mb-6 font-display text-lg font-bold text-white">
                  Create New Ride
                </h3>
                <form className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium text-gray-300">
                      Ride Title
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g., Coastal Sunrise Sprint"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-300">
                      Ride Number
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="T2W-2026-XXX"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-300">
                      Type
                    </label>
                    <select className="input-field cursor-pointer">
                      <option value="day">Day Ride</option>
                      <option value="weekend">Weekend</option>
                      <option value="multi-day">Multi-Day</option>
                      <option value="expedition">Expedition</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-300">
                      Start Date
                    </label>
                    <input type="date" className="input-field" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-300">
                      End Date
                    </label>
                    <input type="date" className="input-field" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-300">
                      Start Location
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="Starting point"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-300">
                      End Location
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="Destination"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-300">
                      Distance (km)
                    </label>
                    <input
                      type="number"
                      className="input-field"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-300">
                      Max Riders
                    </label>
                    <input
                      type="number"
                      className="input-field"
                      placeholder="20"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-300">
                      Registration Fee (₹)
                    </label>
                    <input
                      type="number"
                      className="input-field"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-300">
                      Difficulty
                    </label>
                    <select className="input-field cursor-pointer">
                      <option value="easy">Easy</option>
                      <option value="moderate">Moderate</option>
                      <option value="challenging">Challenging</option>
                      <option value="extreme">Extreme</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium text-gray-300">
                      Description
                    </label>
                    <textarea
                      rows={3}
                      className="input-field resize-none"
                      placeholder="Describe the ride..."
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium text-gray-300">
                      Ride Poster URL
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="URL to ride poster image"
                    />
                  </div>
                  <div className="sm:col-span-2 flex gap-3">
                    <button type="button" className="btn-primary">
                      Publish Ride
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setShowAddRide(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Rides List */}
            <div className="space-y-3">
              {mockRides.map((ride) => (
                <div
                  key={ride.id}
                  className="card flex flex-col gap-4 sm:flex-row sm:items-center"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-white truncate">
                        {ride.title}
                      </h4>
                      <span
                        className={`shrink-0 rounded-lg px-2 py-0.5 text-xs font-medium capitalize ${
                          ride.status === "upcoming"
                            ? "bg-blue-400/10 text-blue-400"
                            : ride.status === "completed"
                            ? "bg-green-400/10 text-green-400"
                            : "bg-gray-400/10 text-gray-400"
                        }`}
                      >
                        {ride.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-t2w-muted">
                      {ride.rideNumber} · {ride.startLocation} →{" "}
                      {ride.endLocation} · {ride.distanceKm} km
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button className="flex items-center gap-1.5 rounded-lg bg-t2w-surface-light px-3 py-2 text-xs text-t2w-muted transition-colors hover:text-white">
                      <Eye className="h-3.5 w-3.5" />
                      View
                    </button>
                    <button className="flex items-center gap-1.5 rounded-lg bg-t2w-surface-light px-3 py-2 text-xs text-t2w-muted transition-colors hover:text-white">
                      <Edit3 className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button className="flex items-center gap-1.5 rounded-lg bg-red-400/10 px-3 py-2 text-xs text-red-400 transition-colors hover:bg-red-400/20">
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Content Tab */}
        {activeTab === "content" && (
          <div>
            <div className="mb-6 flex items-center justify-between">
              <h3 className="font-display text-xl font-bold text-white">
                Copyrighted Content
              </h3>
              <button className="btn-primary flex items-center gap-2 !px-4 !py-2.5 text-sm">
                <Plus className="h-4 w-4" />
                Add Content
              </button>
            </div>

            <div className="space-y-3">
              {mockContent.map((content) => (
                <div
                  key={content.id}
                  className="card flex flex-col gap-4 sm:flex-row sm:items-center"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-400/10">
                    <Copyright className="h-5 w-5 text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-white">
                      {content.title}
                    </h4>
                    <p className="mt-0.5 text-sm text-t2w-muted">
                      {content.type} · Last updated{" "}
                      {new Date(content.lastUpdated).toLocaleDateString(
                        "en-IN",
                        { day: "numeric", month: "short", year: "numeric" }
                      )}
                    </p>
                  </div>
                  <span
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                      content.status === "published"
                        ? "bg-green-400/10 text-green-400"
                        : "bg-yellow-400/10 text-yellow-400"
                    }`}
                  >
                    {content.status}
                  </span>
                  <div className="flex gap-2">
                    <button className="flex items-center gap-1.5 rounded-lg bg-t2w-surface-light px-3 py-2 text-xs text-t2w-muted transition-colors hover:text-white">
                      <Edit3 className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button className="flex items-center gap-1.5 rounded-lg bg-red-400/10 px-3 py-2 text-xs text-red-400 transition-colors hover:bg-red-400/20">
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
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
