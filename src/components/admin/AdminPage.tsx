"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Shield,
  Users,
  Bike,
  Download,
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
  Settings,
  Save,
  ToggleLeft,
  ToggleRight,
  Clock,
  RotateCcw,
  Activity,
  Grid3X3,
  Merge,
  ClipboardList,
  Award,
  Trophy,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api-client";
import { ParticipationMatrix } from "./ParticipationMatrix";
import { MergeProfiles } from "./MergeProfiles";
import { ArenaSettingsTab } from "./ArenaSettingsTab";
import type { ActivityLogEntry } from "@/lib/api-client";
import type { UserRole } from "@/types";

type AdminTab = "dashboard" | "users" | "rides" | "matrix" | "merge" | "badges" | "content" | "approvals" | "form-settings" | "activity" | "arena";

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
  authorName: string;
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
  admin: "Core Member",  // legacy role — treat as core_member for display
};

const ROLE_COLORS: Record<string, string> = {
  superadmin: "bg-red-400/10 text-red-400",
  core_member: "bg-t2w-accent/10 text-t2w-accent",
  t2w_rider: "bg-green-400/10 text-green-400",
  rider: "bg-t2w-surface-light text-t2w-muted",
  admin: "bg-t2w-accent/10 text-t2w-accent",  // legacy role — same colour as core_member
};

type RiderSearchResult = { id: string; name: string; email: string; phone: string; riderProfileId?: string | null; userId?: string | null };

function CrewAutocomplete({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<RiderSearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value); }, [value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const searchRiders = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 1) { setResults([]); setShowDropdown(false); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/riders/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results || []);
          setShowDropdown(true);
        }
      } catch { /* ignore */ }
      setSearching(false);
    }, 300);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <label className="mb-1.5 block text-sm font-medium text-gray-300">{label}</label>
      <input
        type="text"
        className="input-field"
        placeholder={placeholder || "Type to search..."}
        value={query}
        onChange={(e) => { setQuery(e.target.value); onChange(e.target.value); searchRiders(e.target.value); }}
        onFocus={() => { if (results.length > 0) setShowDropdown(true); }}
      />
      {searching && <Loader2 className="absolute right-3 top-9 h-4 w-4 animate-spin text-t2w-muted" />}
      {showDropdown && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-t2w-border bg-t2w-surface shadow-xl max-h-48 overflow-y-auto">
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              className="w-full px-3 py-2 text-left text-sm hover:bg-t2w-surface-light transition-colors flex flex-col"
              onClick={() => { setQuery(r.name); onChange(r.name); setShowDropdown(false); }}
            >
              <span className="text-white font-medium">{r.name}</span>
              <span className="text-xs text-t2w-muted">{r.phone || "—"} / {r.email || "—"}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

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
  const [bulkApproving, setBulkApproving] = useState(false);
  const [bulkRejecting, setBulkRejecting] = useState(false);

  const [rideForm, setRideForm] = useState({
    title: "", rideNumber: "", type: "day", startDate: "", endDate: "",
    startLocation: "", startLocationUrl: "", endLocation: "", endLocationUrl: "",
    distanceKm: "", maxRiders: "20", fee: "0", difficulty: "easy", description: "",
    organisedBy: "", leadRider: "", sweepRider: "",
  });
  const [rideFormUseCustomSettings, setRideFormUseCustomSettings] = useState(false);
  const [rideFormCustomSettings, setRideFormCustomSettings] = useState<string[]>([]); // hidden fields for this ride
  const [rideFormUpiOverride, setRideFormUpiOverride] = useState(false);
  const [rideFormUpiIds, setRideFormUpiIds] = useState<{ label: string; id: string }[]>([{ label: "", id: "" }]);
  const [rideFormRegSchedule, setRideFormRegSchedule] = useState({ enabled: false, regOpenCore: "", regOpenT2w: "", regOpenRider: "" });
  const [publishingRide, setPublishingRide] = useState(false);

  // Edit ride state
  const [editingRideId, setEditingRideId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    title: "", rideNumber: "", type: "day", status: "upcoming",
    startDate: "", endDate: "", startLocation: "", startLocationUrl: "", endLocation: "", endLocationUrl: "",
    distanceKm: "", maxRiders: "20", fee: "0", difficulty: "easy",
    description: "", leadRider: "", sweepRider: "", meetupTime: "",
    rideStartTime: "", startingPoint: "", organisedBy: "", accountsBy: "",
    highlights: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // Ride rider management state
  const [editRideRiders, setEditRideRiders] = useState<string[]>([]);
  const [newRiderName, setNewRiderName] = useState("");
  const [selectedRiderIds, setSelectedRiderIds] = useState<{ riderProfileId?: string | null; userId?: string | null }>({});
  const [riderAddError, setRiderAddError] = useState("");
  const [ridersLoaded, setRidersLoaded] = useState(false);
  const [riderSearchResults, setRiderSearchResults] = useState<RiderSearchResult[]>([]);
  const [riderSearchDropdown, setRiderSearchDropdown] = useState(false);
  const [riderSearching, setRiderSearching] = useState(false);
  const riderSearchDebounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const riderInputWrapperRef = useRef<HTMLDivElement>(null);
  // Per-ride form settings for edit
  const [editRideUseCustomSettings, setEditRideUseCustomSettings] = useState(false);
  const [editRideFormCustomSettings, setEditRideFormCustomSettings] = useState<string[]>([]);
  const [editRideUpiOverride, setEditRideUpiOverride] = useState(false);
  const [editRideUpiIds, setEditRideUpiIds] = useState<{ label: string; id: string }[]>([{ label: "", id: "" }]);
  const [editRideRegSchedule, setEditRideRegSchedule] = useState({ enabled: false, regOpenCore: "", regOpenT2w: "", regOpenRider: "" });

  // Registration management state
  const [managingRegsRideId, setManagingRegsRideId] = useState<string | null>(null);
  const [rideRegistrations, setRideRegistrations] = useState<Array<{
    id: string; userId: string; riderName: string; email: string; phone: string;
    registeredAt: string; confirmationCode: string; approvalStatus: string;
    address: string; emergencyContactName: string; emergencyContactPhone: string;
    bloodGroup: string; referredBy: string; foodPreference: string; ridingType: string;
    vehicleModel: string; vehicleRegNumber: string; tshirtSize: string;
  }>>([]);
  const [loadingRegs, setLoadingRegs] = useState(false);
  const [updatingRegId, setUpdatingRegId] = useState<string | null>(null);

  // Delete confirmation modal state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: "ride" | "user" | "bulk-users";
    id: string;
    name: string;
    data?: unknown;
  } | null>(null);

  // Activity log state
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [rollingBack, setRollingBack] = useState<string | null>(null);

  // Badge management state (SuperAdmin)
  const [adminBadges, setAdminBadges] = useState<Array<{
    id: string; tier: string; name: string; description: string; minKm: number; icon: string; color: string;
  }>>([]);
  const [badgesLoaded, setBadgesLoaded] = useState(false);
  const [editingBadgeId, setEditingBadgeId] = useState<string | null>(null);
  const [badgeEditForm, setBadgeEditForm] = useState({ name: "", description: "", minKm: "", icon: "", color: "" });
  const [savingBadge, setSavingBadge] = useState(false);

  // Registration form settings (SuperAdmin)
  const [formSettingsLoaded, setFormSettingsLoaded] = useState(false);
  const [savingFormSettings, setSavingFormSettings] = useState(false);
  const [formSettings, setFormSettings] = useState({
    cancellationText: "Post registration, if you cancel\n1. Partial Refund: If the stay owner waives the booking charge or if a replacement rider is found, a cancellation fee of \u20B9500 will be deducted and the remaining amount will be refunded to you.\n2. No Refund: If a replacement rider is not available and the stay owner charges for your reserved slot, we will be unable to offer a refund.",
    upiIds: [{ label: "", id: "taleson2wheels@upi" }] as { label: string; id: string }[],
    bankAccounts: [{ label: "", details: "Contact admin for details" }] as { label: string; details: string }[],
    // Keep legacy fields for backward compat reading
    upiId: "taleson2wheels@upi",
    bankDetails: "Contact admin for details",
    hiddenFields: [] as string[],
    enableTshirtSize: false,
    paymentMode: "screenshot" as "screenshot" | "transaction_id" | "both",
  });

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

    // Load activity log + auto-sync roles/dropouts for superadmin
    if (isSuperAdmin) {
      api.activityLog.list().then((data) => {
        setActivityLog(data.entries);
      });
      // Auto-clear dropouts and sync roles on admin page load
      api.participation.syncRoles().catch(() => {});
      // Load badge tiers for badge management
      api.badges.list().then((data: { badges: typeof adminBadges }) => {
        setAdminBadges(data.badges || []);
        setBadgesLoaded(true);
      }).catch(() => setBadgesLoaded(true));
    }

    // Load form settings (with migration from legacy single UPI/bank to arrays)
    api.regFormSettings.get().then((s) => {
      if (s && Object.keys(s).length > 0) {
        const merged = { ...s } as Record<string, unknown>;
        // Migrate legacy single upiId to upiIds array
        if (!merged.upiIds && merged.upiId) {
          merged.upiIds = [{ label: "", id: merged.upiId as string }];
        }
        // Migrate legacy single bankDetails to bankAccounts array
        if (!merged.bankAccounts && merged.bankDetails) {
          merged.bankAccounts = [{ label: "", details: merged.bankDetails as string }];
        }
        if (!merged.paymentMode) merged.paymentMode = "screenshot";
        setFormSettings((prev) => ({ ...prev, ...merged } as typeof prev));
      }
      setFormSettingsLoaded(true);
    });
  }, [user, isCoreOrAbove]);

  const approveUser = async (id: string) => {
    try {
      const targetUser = pendingUsers.find((u) => u.id === id);
      await api.users.approve(id);
      setPendingUsers((prev) => prev.filter((u) => u.id !== id));
      if (stats) setStats({ ...stats, pendingUsers: stats.pendingUsers - 1 });
      api.activityLog.add({
        action: "user_approved",
        performedBy: user!.id,
        performedByName: user!.name,
        targetId: id,
        targetName: targetUser?.name || id,
        details: `Approved user "${targetUser?.name || id}"`,
      });
    } catch (err) {
      console.error("Failed to approve user:", err);
    }
  };

  const rejectUser = async (id: string) => {
    try {
      const targetUser = pendingUsers.find((u) => u.id === id);
      await api.users.reject(id);
      setPendingUsers((prev) => prev.filter((u) => u.id !== id));
      if (stats) setStats({ ...stats, pendingUsers: stats.pendingUsers - 1, totalUsers: stats.totalUsers - 1 });
      api.activityLog.add({
        action: "user_rejected",
        performedBy: user!.id,
        performedByName: user!.name,
        targetId: id,
        targetName: targetUser?.name || id,
        details: `Rejected user "${targetUser?.name || id}"`,
      });
    } catch (err) {
      console.error("Failed to reject user:", err);
    }
  };

  const updateRideStatus = async (rideId: string, newStatus: string) => {
    const ride = rides.find((r) => r.id === rideId);
    if (!ride) return;
    const previousStatus = ride.status;
    // Optimistic update
    setRides((prev) => prev.map((r) => r.id === rideId ? { ...r, status: newStatus } : r));
    try {
      await api.rides.update(rideId, { status: newStatus });
      api.activityLog.add({
        action: "ride_edited",
        performedBy: user!.id,
        performedByName: user!.name,
        targetId: rideId,
        targetName: ride.title,
        details: `Changed ride status from "${previousStatus}" to "${newStatus}"`,
      });
    } catch {
      // Revert on failure
      setRides((prev) => prev.map((r) => r.id === rideId ? { ...r, status: previousStatus } : r));
    }
  };

  const confirmDeleteRide = (ride: AdminRide) => {
    setDeleteConfirm({ type: "ride", id: ride.id, name: ride.title });
  };

  const executeDeleteRide = async () => {
    if (!deleteConfirm || deleteConfirm.type !== "ride" || !canDeleteRide) return;
    const { id, name } = deleteConfirm;
    try {
      // Fetch full ride data for rollback before deleting
      const result = await api.rides.get(id);
      const rideData = (result as { ride: Record<string, unknown> }).ride;
      await api.rides.delete(id);
      setRides((prev) => prev.filter((r) => r.id !== id));
      api.activityLog.add({
        action: "ride_deleted",
        performedBy: user!.id,
        performedByName: user!.name,
        targetId: id,
        targetName: name,
        details: `Deleted ride "${name}"`,
        rollbackData: rideData,
      });
      setActivityLog(prev => [{ id: `log-${Date.now()}`, action: "ride_deleted", performedBy: user!.id, performedByName: user!.name, timestamp: new Date().toISOString(), targetId: id, targetName: name, details: `Deleted ride "${name}"`, rollbackData: rideData }, ...prev]);
    } catch (err) {
      console.error("Failed to delete ride:", err);
    } finally {
      setDeleteConfirm(null);
    }
  };

  const startEditRide = async (id: string) => {
    try {
      const result = await api.rides.get(id);
      const r = (result as { ride: Record<string, unknown> }).ride;
      setEditForm({
        title: String(r.title || ""),
        rideNumber: String(r.rideNumber || ""),
        type: String(r.type || "day"),
        status: String(r.status || "upcoming"),
        startDate: String(r.startDate || "").split("T")[0],
        endDate: String(r.endDate || "").split("T")[0],
        startLocation: String(r.startLocation || ""),
        startLocationUrl: String(r.startLocationUrl || ""),
        endLocation: String(r.endLocation || ""),
        endLocationUrl: String(r.endLocationUrl || ""),
        distanceKm: String(r.distanceKm || ""),
        maxRiders: String(r.maxRiders || "20"),
        fee: String(r.fee || "0"),
        difficulty: String(r.difficulty || "easy"),
        description: String(r.description || ""),
        leadRider: String(r.leadRider || ""),
        sweepRider: String(r.sweepRider || ""),
        meetupTime: String(r.meetupTime || ""),
        rideStartTime: String(r.rideStartTime || ""),
        startingPoint: String(r.startingPoint || ""),
        organisedBy: String(r.organisedBy || ""),
        accountsBy: String(r.accountsBy || ""),
        highlights: Array.isArray(r.highlights) ? (r.highlights as string[]).join("\n") : "",
      });
      // Single source of truth: only use confirmed registrations for the rider list.
      const confirmedNames = Array.isArray(r.confirmedRiderNames) ? (r.confirmedRiderNames as string[]) : [];
      setEditRideRiders(confirmedNames);
      // Load per-ride form settings
      const rideRegSettings = r.regFormSettings as Record<string, unknown> | null;
      setEditRideFormCustomSettings(rideRegSettings ? ((rideRegSettings.hiddenFields as string[]) || []) : []);
      setEditRideUseCustomSettings(!!rideRegSettings);
      const perRideUpiIds = rideRegSettings?.upiIds as { label: string; id: string }[] | undefined;
      setEditRideUpiOverride(!!perRideUpiIds?.length);
      setEditRideUpiIds(perRideUpiIds?.length ? perRideUpiIds : [{ label: "", id: "" }]);
      // Load registration schedule
      const hasRegSchedule = !!(r.regOpenCore || r.regOpenT2w || r.regOpenRider);
      const toLocalDatetime = (iso: string | null | undefined) => {
        if (!iso) return "";
        const d = new Date(iso);
        const pad = (n: number) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      };
      setEditRideRegSchedule({
        enabled: hasRegSchedule,
        regOpenCore: toLocalDatetime(r.regOpenCore as string | null),
        regOpenT2w: toLocalDatetime(r.regOpenT2w as string | null),
        regOpenRider: toLocalDatetime(r.regOpenRider as string | null),
      });
      setRidersLoaded(true);
      setNewRiderName("");
      setEditingRideId(id);
    } catch (err) {
      console.error("Failed to load ride:", err);
    }
  };

  // Click-outside handler for rider search dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (riderInputWrapperRef.current && !riderInputWrapperRef.current.contains(e.target as Node)) {
        setRiderSearchDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const searchRidersForManage = useCallback((q: string) => {
    if (riderSearchDebounceRef.current) clearTimeout(riderSearchDebounceRef.current);
    if (q.length < 1) { setRiderSearchResults([]); setRiderSearchDropdown(false); return; }
    riderSearchDebounceRef.current = setTimeout(async () => {
      setRiderSearching(true);
      try {
        const res = await fetch(`/api/riders/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          setRiderSearchResults(data.results || []);
          setRiderSearchDropdown(true);
        }
      } catch { /* ignore */ }
      setRiderSearching(false);
    }, 300);
  }, []);

  const handleAddRider = async () => {
    if (!editingRideId || !newRiderName.trim()) return;
    setRiderAddError("");
    try {
      const result = await api.rides.addRider(editingRideId, newRiderName.trim(), {
        riderProfileId: selectedRiderIds.riderProfileId || undefined,
        userId: selectedRiderIds.userId || undefined,
      });
      const addedName = result.riderName || newRiderName.trim();
      setEditRideRiders((prev) => prev.includes(addedName) ? prev : [...prev, addedName]);
      setNewRiderName("");
      setSelectedRiderIds({});
      setRiderSearchResults([]);
      setRiderSearchDropdown(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to add rider";
      setRiderAddError(message);
      console.error("Failed to add rider:", err);
    }
  };

  const handleRemoveRider = async (riderName: string) => {
    if (!editingRideId) return;
    try {
      await api.rides.removeRider(editingRideId, riderName);
      setEditRideRiders((prev) => prev.filter((r) => r !== riderName));
    } catch (err) {
      console.error("Failed to remove rider:", err);
    }
  };

  const saveEditRide = async () => {
    if (!editingRideId || savingEdit) return;
    setSavingEdit(true);
    try {
      // Fetch current ride data for rollback
      const currentResult = await api.rides.get(editingRideId);
      const oldRideData = (currentResult as { ride: Record<string, unknown> }).ride;
      await api.rides.update(editingRideId, {
        title: editForm.title,
        rideNumber: editForm.rideNumber,
        type: editForm.type,
        status: editForm.status,
        startDate: editForm.startDate,
        endDate: editForm.endDate || editForm.startDate,
        startLocation: editForm.startLocation,
        startLocationUrl: editForm.startLocationUrl || null,
        endLocation: editForm.endLocation,
        endLocationUrl: editForm.endLocationUrl || null,
        distanceKm: Number(editForm.distanceKm) || 0,
        maxRiders: Number(editForm.maxRiders) || 20,
        fee: Number(editForm.fee) || 0,
        difficulty: editForm.difficulty,
        description: editForm.description,
        leadRider: editForm.leadRider,
        sweepRider: editForm.sweepRider,
        meetupTime: editForm.meetupTime,
        rideStartTime: editForm.rideStartTime,
        startingPoint: editForm.startingPoint,
        organisedBy: editForm.organisedBy,
        accountsBy: editForm.accountsBy,
        route: [editForm.startLocation, editForm.endLocation],
        highlights: editForm.highlights.split("\n").map((h) => h.trim()).filter(Boolean),
        regFormSettings: (editRideUseCustomSettings || (editRideUpiOverride && editRideUpiIds.some(u => u.id.trim()))) ? {
          ...(editRideUseCustomSettings ? { hiddenFields: editRideFormCustomSettings } : {}),
          ...(editRideUpiOverride && editRideUpiIds.some(u => u.id.trim()) ? { upiIds: editRideUpiIds.filter(u => u.id.trim()) } : {}),
        } : null,
        regOpenCore: editRideRegSchedule.enabled && editRideRegSchedule.regOpenCore ? new Date(editRideRegSchedule.regOpenCore).toISOString() : null,
        regOpenT2w: editRideRegSchedule.enabled && editRideRegSchedule.regOpenT2w ? new Date(editRideRegSchedule.regOpenT2w).toISOString() : null,
        regOpenRider: editRideRegSchedule.enabled && editRideRegSchedule.regOpenRider ? new Date(editRideRegSchedule.regOpenRider).toISOString() : null,
      });
      // Refresh rides list
      const ridesData = await api.rides.list();
      setRides((ridesData as { rides: AdminRide[] }).rides);
      api.activityLog.add({
        action: "ride_edited",
        performedBy: user!.id,
        performedByName: user!.name,
        targetId: editingRideId,
        targetName: editForm.title,
        details: `Edited ride "${editForm.title}"`,
        rollbackData: oldRideData,
      });
      setActivityLog(prev => [{ id: `log-${Date.now()}`, action: "ride_edited", performedBy: user!.id, performedByName: user!.name, timestamp: new Date().toISOString(), targetId: editingRideId, targetName: editForm.title, details: `Edited ride "${editForm.title}"`, rollbackData: oldRideData }, ...prev]);
      setEditingRideId(null);
    } catch (err) {
      console.error("Failed to update ride:", err);
    } finally {
      setSavingEdit(false);
    }
  };

  const loadRegistrations = async (rideId: string) => {
    if (managingRegsRideId === rideId) {
      setManagingRegsRideId(null);
      return;
    }
    setLoadingRegs(true);
    setManagingRegsRideId(rideId);
    try {
      const res = await fetch(`/api/rides/${rideId}/registrations`);
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setRideRegistrations(data.registrations || []);
    } catch {
      setRideRegistrations([]);
    } finally {
      setLoadingRegs(false);
    }
  };

  const updateRegStatus = async (rideId: string, regId: string, status: "confirmed" | "rejected" | "dropout") => {
    setUpdatingRegId(regId);
    try {
      const res = await fetch(`/api/rides/${rideId}/registrations/${regId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvalStatus: status }),
      });
      if (!res.ok) throw new Error("Failed to update");
      setRideRegistrations((prev) => prev.map((r) => r.id === regId ? { ...r, approvalStatus: status } : r));
      // The PATCH endpoint handles all sync (participation + Ride.riders cache).
      // Update local edit riders list to stay in sync with confirmed registrations.
      const reg = rideRegistrations.find((r) => r.id === regId);
      if (reg?.riderName) {
        if (status === "confirmed") {
          setEditRideRiders((prev) => prev.includes(reg.riderName) ? prev : [...prev, reg.riderName]);
        } else {
          setEditRideRiders((prev) => prev.filter((r) => r !== reg.riderName));
        }
      }
      // Refresh ride list to update count
      const ridesData = await api.rides.list();
      setRides((ridesData as { rides: AdminRide[] }).rides);
    } catch {
      alert("Failed to update registration status");
    } finally {
      setUpdatingRegId(null);
    }
  };

  const changeUserRole = async (userId: string, newRole: UserRole) => {
    if (!canManageRoles) return;
    try {
      const targetUser = allUsers.find((u) => u.id === userId);
      const previousRole = targetUser?.role || "rider";
      await api.users.changeRole(userId, newRole);
      setAllUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
      setRoleChangeUser(null);
      api.activityLog.add({
        action: "user_role_changed",
        performedBy: user!.id,
        performedByName: user!.name,
        targetId: userId,
        targetName: targetUser?.name || userId,
        details: `Changed role from ${ROLE_LABELS[previousRole] || previousRole} to ${ROLE_LABELS[newRole] || newRole}`,
        rollbackData: { previousRole },
      });
      setActivityLog(prev => [{ id: `log-${Date.now()}`, action: "user_role_changed", performedBy: user!.id, performedByName: user!.name, timestamp: new Date().toISOString(), targetId: userId, targetName: targetUser?.name || userId, details: `Changed role from ${ROLE_LABELS[previousRole] || previousRole} to ${ROLE_LABELS[newRole] || newRole}`, rollbackData: { previousRole } }, ...prev]);
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

  const confirmDeleteUser = (id: string, name: string) => {
    const userData = allUsers.find((u) => u.id === id);
    setDeleteConfirm({ type: "user", id, name, data: userData });
  };

  const executeDeleteUser = async () => {
    if (!deleteConfirm || deleteConfirm.type !== "user") return;
    const { id, name, data } = deleteConfirm;
    try {
      await api.users.delete(id);
      setAllUsers((prev) => prev.filter((u) => u.id !== id));
      api.activityLog.add({
        action: "user_deleted",
        performedBy: user!.id,
        performedByName: user!.name,
        targetId: id,
        targetName: name,
        details: `Deleted user "${name}"`,
        rollbackData: data,
      });
      setActivityLog(prev => [{ id: `log-${Date.now()}`, action: "user_deleted", performedBy: user!.id, performedByName: user!.name, timestamp: new Date().toISOString(), targetId: id, targetName: name, details: `Deleted user "${name}"`, rollbackData: data }, ...prev]);
    } catch (err) {
      console.error("Failed to delete user:", err);
    } finally {
      setDeleteConfirm(null);
    }
  };

  const confirmDeleteNonGmailUsers = () => {
    if (nonGmailUsers.length === 0) return;
    setDeleteConfirm({
      type: "bulk-users",
      id: "bulk",
      name: `${nonGmailUsers.length} non-Gmail users`,
      data: nonGmailUsers,
    });
  };

  const executeDeleteBulkUsers = async () => {
    if (!deleteConfirm || deleteConfirm.type !== "bulk-users") return;
    setDeletingUsers(true);
    try {
      const ids = nonGmailUsers.map((u) => u.id);
      await api.users.bulkDelete(ids);
      setAllUsers((prev) => prev.filter((u) => !ids.includes(u.id)));
      api.activityLog.add({
        action: "user_bulk_deleted",
        performedBy: user!.id,
        performedByName: user!.name,
        targetId: "bulk",
        targetName: `${nonGmailUsers.length} non-Gmail users`,
        details: `Bulk deleted ${nonGmailUsers.length} non-Gmail users`,
        rollbackData: { users: deleteConfirm.data },
      });
      setActivityLog(prev => [{ id: `log-${Date.now()}`, action: "user_bulk_deleted", performedBy: user!.id, performedByName: user!.name, timestamp: new Date().toISOString(), targetId: "bulk", targetName: `${nonGmailUsers.length} non-Gmail users`, details: `Bulk deleted ${nonGmailUsers.length} non-Gmail users`, rollbackData: { users: deleteConfirm.data } }, ...prev]);
    } catch (err) {
      console.error("Failed to bulk delete users:", err);
    } finally {
      setDeletingUsers(false);
      setDeleteConfirm(null);
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
        startLocationUrl: rideForm.startLocationUrl || null,
        endLocation: rideForm.endLocation,
        endLocationUrl: rideForm.endLocationUrl || null,
        distanceKm: Number(rideForm.distanceKm) || 0,
        maxRiders: Number(rideForm.maxRiders) || 20,
        registeredRiders: 0,
        fee: Number(rideForm.fee) || 0,
        difficulty: rideForm.difficulty,
        description: rideForm.description,
        route: [rideForm.startLocation, rideForm.endLocation],
        highlights: [],
        organisedBy: rideForm.organisedBy || null,
        leadRider: rideForm.leadRider || "",
        sweepRider: rideForm.sweepRider || "",
        regFormSettings: (rideFormUseCustomSettings || (rideFormUpiOverride && rideFormUpiIds.some(u => u.id.trim()))) ? {
          ...(rideFormUseCustomSettings ? { hiddenFields: rideFormCustomSettings } : {}),
          ...(rideFormUpiOverride && rideFormUpiIds.some(u => u.id.trim()) ? { upiIds: rideFormUpiIds.filter(u => u.id.trim()) } : {}),
        } : null,
        regOpenCore: rideFormRegSchedule.enabled && rideFormRegSchedule.regOpenCore ? new Date(rideFormRegSchedule.regOpenCore).toISOString() : null,
        regOpenT2w: rideFormRegSchedule.enabled && rideFormRegSchedule.regOpenT2w ? new Date(rideFormRegSchedule.regOpenT2w).toISOString() : null,
        regOpenRider: rideFormRegSchedule.enabled && rideFormRegSchedule.regOpenRider ? new Date(rideFormRegSchedule.regOpenRider).toISOString() : null,
      });
      const newRide = (result as { ride: AdminRide }).ride;
      setRides((prev) => [newRide, ...prev]);
      setShowAddRide(false);
      api.activityLog.add({
        action: "ride_created",
        performedBy: user!.id,
        performedByName: user!.name,
        targetId: newRide.id,
        targetName: rideForm.title,
        details: `Created ride "${rideForm.title}" (${rideForm.rideNumber})`,
      });
      setActivityLog(prev => [{ id: `log-${Date.now()}`, action: "ride_created", performedBy: user!.id, performedByName: user!.name, timestamp: new Date().toISOString(), targetId: newRide.id, targetName: rideForm.title, details: `Created ride "${rideForm.title}" (${rideForm.rideNumber})` }, ...prev]);
      setRideForm({ title: "", rideNumber: "", type: "day", startDate: "", endDate: "", startLocation: "", startLocationUrl: "", endLocation: "", endLocationUrl: "", distanceKm: "", maxRiders: "20", fee: "0", difficulty: "easy", description: "", organisedBy: "", leadRider: "", sweepRider: "" });
      setRideFormUseCustomSettings(false);
      setRideFormCustomSettings([]);
      setRideFormRegSchedule({ enabled: false, regOpenCore: "", regOpenT2w: "", regOpenRider: "" });
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

  const saveFormSettings = async () => {
    setSavingFormSettings(true);
    try {
      await api.regFormSettings.save(formSettings as unknown as Record<string, unknown>);
      api.activityLog.add({ action: "form_settings_saved", performedBy: user!.id, performedByName: user!.name, targetId: "form-settings", targetName: "Registration Form", details: "Updated registration form settings" });
      alert("Registration form settings saved successfully!");
    } catch {
      alert("Failed to save settings.");
    } finally {
      setSavingFormSettings(false);
    }
  };

  const toggleHiddenField = (field: string) => {
    setFormSettings((prev) => ({
      ...prev,
      hiddenFields: prev.hiddenFields.includes(field)
        ? prev.hiddenFields.filter((f) => f !== field)
        : [...prev.hiddenFields, field],
    }));
  };

  const approveBlog = async (id: string) => {
    if (!user) return;
    const blog = pendingBlogs.find((b) => b.id === id);
    await api.blogs.approve(id, user.id);
    setPendingBlogs((prev) => prev.filter((b) => b.id !== id));
    api.activityLog.add({ action: "blog_approved", performedBy: user.id, performedByName: user.name, targetId: id, targetName: blog?.title || id, details: `Approved blog "${blog?.title || id}"` });
  };

  const rejectBlog = async (id: string) => {
    if (!user) return;
    const blog = pendingBlogs.find((b) => b.id === id);
    await api.blogs.reject(id, user.id);
    setPendingBlogs((prev) => prev.filter((b) => b.id !== id));
    api.activityLog.add({ action: "blog_rejected", performedBy: user.id, performedByName: user.name, targetId: id, targetName: blog?.title || id, details: `Rejected blog "${blog?.title || id}"` });
  };

  const approvePost = async (id: string) => {
    if (!user) return;
    const post = pendingPosts.find((p) => p.id === id);
    await api.ridePosts.approve(id, user.id);
    setPendingPosts((prev) => prev.filter((p) => p.id !== id));
    api.activityLog.add({ action: "post_approved", performedBy: user.id, performedByName: user.name, targetId: id, targetName: post?.authorName || id, details: `Approved ride post by ${post?.authorName || id}` });
  };

  const rejectPost = async (id: string) => {
    if (!user) return;
    const post = pendingPosts.find((p) => p.id === id);
    await api.ridePosts.reject(id, user.id);
    setPendingPosts((prev) => prev.filter((p) => p.id !== id));
    api.activityLog.add({ action: "post_rejected", performedBy: user.id, performedByName: user.name, targetId: id, targetName: post?.authorName || id, details: `Rejected ride post by ${post?.authorName || id}` });
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
    ...(isSuperAdmin
      ? [{ key: "matrix" as const, label: "Matrix", icon: Grid3X3 }]
      : []),
    ...(isSuperAdmin
      ? [{ key: "merge" as const, label: "Merge Profiles", icon: Merge }]
      : []),
    ...(isSuperAdmin
      ? [{ key: "badges" as const, label: "Badges", icon: Award }]
      : []),
    { key: "approvals" as const, label: "Approvals", icon: BookOpen, badge: pendingBlogs.length + pendingPosts.length },
    { key: "content" as const, label: "Content", icon: Copyright },
    ...(isSuperAdmin
      ? [{ key: "form-settings" as const, label: "Form Settings", icon: Settings }]
      : []),
    ...(isSuperAdmin
      ? [{ key: "activity" as const, label: "Activity", icon: Activity }]
      : []),
    ...(isSuperAdmin
      ? [{ key: "arena" as const, label: "Arena Settings", icon: Trophy }]
      : []),
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
        <div className="mb-8 flex gap-2 border-b border-t2w-border pb-4 overflow-x-auto flex-nowrap scrollbar-thin scrollbar-track-transparent scrollbar-thumb-t2w-border" style={{ scrollbarWidth: "thin" }}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium whitespace-nowrap transition-all ${
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
                <div className="mb-6 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 font-display text-xl font-bold text-white">
                    <UserPlus className="h-5 w-5 text-yellow-400" />
                    Pending Registrations ({pendingUsers.length})
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        if (!confirm(`Approve all ${pendingUsers.length} pending users?`)) return;
                        setBulkApproving(true);
                        try {
                          const ids = pendingUsers.map((u) => u.id);
                          await api.users.bulkApprove(ids);
                          setPendingUsers([]);
                          if (stats) setStats({ ...stats, pendingUsers: 0 });
                          api.activityLog.add({
                            action: "user_approved",
                            performedBy: user!.id,
                            performedByName: user!.name,
                            targetId: "bulk",
                            targetName: `${ids.length} users`,
                            details: `Bulk approved ${ids.length} pending users`,
                          });
                          setActivityLog(prev => [{ id: `log-${Date.now()}`, action: "user_approved", performedBy: user!.id, performedByName: user!.name, timestamp: new Date().toISOString(), targetId: "bulk", targetName: `${ids.length} users`, details: `Bulk approved ${ids.length} pending users` }, ...prev]);
                        } catch (err) {
                          console.error("Bulk approve failed:", err);
                          alert("Failed to approve users. Please try again.");
                        } finally {
                          setBulkApproving(false);
                        }
                      }}
                      disabled={bulkApproving || bulkRejecting}
                      className="flex items-center gap-1.5 rounded-lg bg-green-400/10 px-3 py-2 text-xs font-medium text-green-400 transition-colors hover:bg-green-400/20 disabled:opacity-50"
                    >
                      {bulkApproving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                      {bulkApproving ? "Approving..." : "Approve All"}
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm(`Reject all ${pendingUsers.length} pending users? This will delete their accounts.`)) return;
                        setBulkRejecting(true);
                        try {
                          const ids = pendingUsers.map((u) => u.id);
                          await api.users.bulkDelete(ids);
                          const count = pendingUsers.length;
                          setPendingUsers([]);
                          if (stats) setStats({ ...stats, pendingUsers: 0, totalUsers: stats.totalUsers - count });
                          api.activityLog.add({
                            action: "user_bulk_deleted",
                            performedBy: user!.id,
                            performedByName: user!.name,
                            targetId: "bulk",
                            targetName: `${count} pending users`,
                            details: `Bulk rejected (deleted) ${count} pending users`,
                          });
                          setActivityLog(prev => [{ id: `log-${Date.now()}`, action: "user_bulk_deleted", performedBy: user!.id, performedByName: user!.name, timestamp: new Date().toISOString(), targetId: "bulk", targetName: `${count} pending users`, details: `Bulk rejected (deleted) ${count} pending users` }, ...prev]);
                        } catch (err) {
                          console.error("Bulk reject failed:", err);
                          alert("Failed to reject users. Please try again.");
                        } finally {
                          setBulkRejecting(false);
                        }
                      }}
                      disabled={bulkApproving || bulkRejecting}
                      className="flex items-center gap-1.5 rounded-lg bg-red-400/10 px-3 py-2 text-xs font-medium text-red-400 transition-colors hover:bg-red-400/20 disabled:opacity-50"
                    >
                      {bulkRejecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                      {bulkRejecting ? "Rejecting..." : "Reject All"}
                    </button>
                  </div>
                </div>
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
                      onClick={confirmDeleteNonGmailUsers}
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
                                {!["superadmin", "core_member", "t2w_rider", "rider"].includes(u.role) && (
                                  <option value={u.role} disabled>{u.role} (legacy)</option>
                                )}
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
                                onClick={() => confirmDeleteUser(u.id, u.name)}
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
              <div className="flex gap-2">
                {isSuperAdmin && (
                  <button
                    onClick={async () => {
                      if (!confirm("Clear ALL drop-out flags from all rides? This will reinstate all riders.")) return;
                      try {
                        const result = await api.participation.clearAllDropouts();
                        alert(`Cleared ${result.clearedCount} drop-out flags.`);
                        api.activityLog.add({
                          action: "ride_edited",
                          performedBy: user!.id,
                          performedByName: user!.name,
                          targetId: "all-rides",
                          targetName: "All rides",
                          details: `Cleared ${result.clearedCount} drop-out flags from all rides`,
                        });
                      } catch {
                        alert("Failed to clear drop-outs.");
                      }
                    }}
                    className="flex items-center gap-1.5 rounded-lg bg-yellow-400/10 px-3 py-2 text-xs font-medium text-yellow-400 transition-colors hover:bg-yellow-400/20"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Clear All Drop-Outs
                  </button>
                )}
                {canCreateRide && (
                  <button onClick={() => { const next = `#${String(rides.length + 1).padStart(3, "0")}`; setRideForm((prev) => ({ ...prev, rideNumber: next })); setShowAddRide(!showAddRide); }} className="btn-primary flex items-center gap-2 !px-4 !py-2.5 text-sm">
                    <Plus className="h-4 w-4" />
                    Add New Ride
                  </button>
                )}
              </div>
            </div>

            {showAddRide && canCreateRide && (
              <div className="card mb-8">
                <h3 className="mb-6 font-display text-lg font-bold text-white">Create New Ride</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2"><label className="mb-1.5 block text-sm font-medium text-gray-300">Ride Title</label><input type="text" className="input-field" placeholder="e.g., Coastal Sunrise Sprint" value={rideForm.title} onChange={(e) => setRideForm({ ...rideForm, title: e.target.value })} /></div>
                  <div><label className="mb-1.5 block text-sm font-medium text-gray-300">Ride Number</label><input type="text" className="input-field bg-t2w-surface-light/50 cursor-not-allowed" readOnly value={rideForm.rideNumber} /></div>
                  <div><label className="mb-1.5 block text-sm font-medium text-gray-300">Type</label><select className="input-field cursor-pointer" value={rideForm.type} onChange={(e) => setRideForm({ ...rideForm, type: e.target.value })}><option value="day">Day Ride</option><option value="weekend">Weekend</option><option value="multi-day">Multi-Day</option><option value="expedition">Expedition</option></select></div>
                  <div><label className="mb-1.5 block text-sm font-medium text-gray-300">Start Date</label><input type="date" className="input-field" value={rideForm.startDate} onChange={(e) => setRideForm({ ...rideForm, startDate: e.target.value })} /></div>
                  <div><label className="mb-1.5 block text-sm font-medium text-gray-300">End Date</label><input type="date" className="input-field" value={rideForm.endDate} onChange={(e) => setRideForm({ ...rideForm, endDate: e.target.value })} /></div>
                  <div><label className="mb-1.5 block text-sm font-medium text-gray-300">Start Location Name</label><input type="text" className="input-field" placeholder="e.g., Parle G" value={rideForm.startLocation} onChange={(e) => setRideForm({ ...rideForm, startLocation: e.target.value })} /></div>
                  <div><label className="mb-1.5 block text-sm font-medium text-gray-300">Start Location Map Link</label><input type="url" className="input-field" placeholder="Google Maps URL" value={rideForm.startLocationUrl} onChange={(e) => setRideForm({ ...rideForm, startLocationUrl: e.target.value })} /></div>
                  <div><label className="mb-1.5 block text-sm font-medium text-gray-300">End Location Name</label><input type="text" className="input-field" placeholder="e.g., Lonavala" value={rideForm.endLocation} onChange={(e) => setRideForm({ ...rideForm, endLocation: e.target.value })} /></div>
                  <div><label className="mb-1.5 block text-sm font-medium text-gray-300">End Location Map Link</label><input type="url" className="input-field" placeholder="Google Maps URL" value={rideForm.endLocationUrl} onChange={(e) => setRideForm({ ...rideForm, endLocationUrl: e.target.value })} /></div>
                  <div><label className="mb-1.5 block text-sm font-medium text-gray-300">Distance (km)</label><input type="number" className="input-field" placeholder="0" value={rideForm.distanceKm} onChange={(e) => setRideForm({ ...rideForm, distanceKm: e.target.value })} /></div>
                  <div><label className="mb-1.5 block text-sm font-medium text-gray-300">Max Riders</label><input type="number" className="input-field" placeholder="20" value={rideForm.maxRiders} onChange={(e) => setRideForm({ ...rideForm, maxRiders: e.target.value })} /></div>
                  <div><label className="mb-1.5 block text-sm font-medium text-gray-300">Registration Fee</label><input type="number" className="input-field" placeholder="0" value={rideForm.fee} onChange={(e) => setRideForm({ ...rideForm, fee: e.target.value })} /></div>
                  <div><label className="mb-1.5 block text-sm font-medium text-gray-300">Difficulty</label><select className="input-field cursor-pointer" value={rideForm.difficulty} onChange={(e) => setRideForm({ ...rideForm, difficulty: e.target.value })}><option value="easy">Easy</option><option value="moderate">Moderate</option><option value="challenging">Challenging</option><option value="extreme">Extreme</option></select></div>
                  <div className="sm:col-span-2"><label className="mb-1.5 block text-sm font-medium text-gray-300">Description</label><textarea rows={3} className="input-field resize-none" placeholder="Describe the ride..." value={rideForm.description} onChange={(e) => setRideForm({ ...rideForm, description: e.target.value })} /></div>

                  {/* Ride Crew */}
                  <div className="sm:col-span-2 rounded-xl border border-t2w-border bg-t2w-bg p-4">
                    <h4 className="text-sm font-medium text-white mb-3">Ride Crew</h4>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <CrewAutocomplete label="Organised By" placeholder="Search by name, phone, or email" value={rideForm.organisedBy} onChange={(v) => setRideForm({ ...rideForm, organisedBy: v })} />
                      <CrewAutocomplete label="Lead Rider" placeholder="Can be set later" value={rideForm.leadRider} onChange={(v) => setRideForm({ ...rideForm, leadRider: v })} />
                      <CrewAutocomplete label="Sweep Rider" placeholder="Can be set later" value={rideForm.sweepRider} onChange={(v) => setRideForm({ ...rideForm, sweepRider: v })} />
                    </div>
                  </div>

                  {/* Registration Schedule */}
                  <div className="sm:col-span-2 rounded-xl border border-t2w-border bg-t2w-bg p-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={rideFormRegSchedule.enabled} onChange={(e) => setRideFormRegSchedule((prev) => ({ ...prev, enabled: e.target.checked }))} className="h-4 w-4 rounded accent-t2w-accent" />
                      <span className="text-sm font-medium text-white">Staggered registration schedule</span>
                    </label>
                    <p className="mt-1 ml-7 text-xs text-t2w-muted">Open registration at different times for Core, T2W Rider, and Rider/Guest tiers. If unchecked, registration opens immediately for everyone.</p>
                    {rideFormRegSchedule.enabled && (
                      <div className="mt-3 ml-7 grid gap-3 sm:grid-cols-3">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-green-400">Core Members</label>
                          <input type="datetime-local" className="input-field text-sm" value={rideFormRegSchedule.regOpenCore} onChange={(e) => setRideFormRegSchedule((prev) => ({ ...prev, regOpenCore: e.target.value }))} />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-blue-400">T2W Riders</label>
                          <input type="datetime-local" className="input-field text-sm" value={rideFormRegSchedule.regOpenT2w} onChange={(e) => setRideFormRegSchedule((prev) => ({ ...prev, regOpenT2w: e.target.value }))} />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-yellow-400">Riders &amp; Guests</label>
                          <input type="datetime-local" className="input-field text-sm" value={rideFormRegSchedule.regOpenRider} onChange={(e) => setRideFormRegSchedule((prev) => ({ ...prev, regOpenRider: e.target.value }))} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Per-Ride Form Settings */}
                  <div className="sm:col-span-2 rounded-xl border border-t2w-border bg-t2w-bg p-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={rideFormUseCustomSettings} onChange={(e) => setRideFormUseCustomSettings(e.target.checked)} className="h-4 w-4 rounded accent-t2w-accent" />
                      <span className="text-sm font-medium text-white">Customize registration form for this ride</span>
                    </label>
                    <p className="mt-1 ml-7 text-xs text-t2w-muted">Override global form settings. If unchecked, global settings from Form Settings tab will be used.</p>
                    {rideFormUseCustomSettings && (
                      <div className="mt-3 ml-7 space-y-2">
                        <p className="text-xs text-t2w-accent font-medium mb-2">Hide these fields/sections for this ride:</p>
                        {[
                          { key: "address", label: "Address" },
                          { key: "email", label: "Email" },
                          { key: "phone", label: "Phone" },
                          { key: "emergencyContact", label: "Emergency Contact" },
                          { key: "bloodGroup", label: "Blood Group" },
                          { key: "foodPreference", label: "Food Preference" },
                          { key: "ridingType", label: "Riding Type" },
                          { key: "referredBy", label: "Referred By" },
                          { key: "vehicle", label: "Vehicle Details" },
                          { key: "cancellationTerms", label: "Cancellation Terms" },
                          { key: "paymentSection", label: "Payment Section" },
                          { key: "indemnity", label: "Indemnity" },
                        ].map((f) => (
                          <label key={f.key} className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={rideFormCustomSettings.includes(f.key)} onChange={(e) => {
                              setRideFormCustomSettings((prev) => e.target.checked ? [...prev, f.key] : prev.filter((k) => k !== f.key));
                            }} className="h-3.5 w-3.5 rounded accent-t2w-accent" />
                            <span className="text-xs text-gray-300">{f.label}</span>
                          </label>
                        ))}
                      </div>
                    )}

                    {/* Per-ride UPI ID override */}
                    <div className="mt-3 border-t border-t2w-border pt-3">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={rideFormUpiOverride} onChange={(e) => setRideFormUpiOverride(e.target.checked)} className="h-4 w-4 rounded accent-t2w-accent" />
                        <span className="text-sm font-medium text-white">Use a different UPI ID for this ride</span>
                      </label>
                      <p className="mt-1 ml-7 text-xs text-t2w-muted">Overrides the global UPI ID for this ride only. Riders will see this UPI ID + QR code in the registration form.</p>
                      {rideFormUpiOverride && (
                        <div className="mt-3 ml-7 space-y-2">
                          {rideFormUpiIds.map((upi, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <input
                                type="text"
                                className="input-field w-28 shrink-0 text-xs"
                                placeholder="Label (e.g. GPay)"
                                value={upi.label}
                                onChange={(e) => { const u = [...rideFormUpiIds]; u[idx] = { ...u[idx], label: e.target.value }; setRideFormUpiIds(u); }}
                              />
                              <input
                                type="text"
                                className="input-field flex-1 text-xs font-mono"
                                placeholder="UPI ID (e.g. name@upi)"
                                value={upi.id}
                                onChange={(e) => { const u = [...rideFormUpiIds]; u[idx] = { ...u[idx], id: e.target.value }; setRideFormUpiIds(u); }}
                              />
                              {rideFormUpiIds.length > 1 && (
                                <button type="button" onClick={() => setRideFormUpiIds(rideFormUpiIds.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-300 text-xs">✕</button>
                              )}
                            </div>
                          ))}
                          <button type="button" onClick={() => setRideFormUpiIds([...rideFormUpiIds, { label: "", id: "" }])} className="text-xs text-t2w-accent hover:underline">+ Add another UPI ID</button>
                        </div>
                      )}
                    </div>
                  </div>

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
                <div key={ride.id}>
                  <div className="card flex flex-col gap-4 sm:flex-row sm:items-center">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-white truncate">{ride.title}</h4>
                        {isCoreOrAbove ? (
                          <select
                            value={ride.status}
                            onChange={(e) => updateRideStatus(ride.id, e.target.value)}
                            className={`shrink-0 cursor-pointer rounded-lg border-0 px-2 py-0.5 text-xs font-medium capitalize outline-none ${
                              ride.status === "upcoming" ? "bg-blue-400/10 text-blue-400" : ride.status === "ongoing" ? "bg-yellow-400/10 text-yellow-400" : ride.status === "completed" ? "bg-green-400/10 text-green-400" : ride.status === "cancelled" ? "bg-red-400/10 text-red-400" : "bg-gray-400/10 text-gray-400"
                            }`}
                          >
                            <option value="upcoming">Upcoming</option>
                            <option value="ongoing">Ongoing</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        ) : (
                          <span className={`shrink-0 rounded-lg px-2 py-0.5 text-xs font-medium capitalize ${
                            ride.status === "upcoming" ? "bg-blue-400/10 text-blue-400" : ride.status === "ongoing" ? "bg-yellow-400/10 text-yellow-400" : ride.status === "completed" ? "bg-green-400/10 text-green-400" : ride.status === "cancelled" ? "bg-red-400/10 text-red-400" : "bg-gray-400/10 text-gray-400"
                          }`}>{ride.status === "ongoing" ? "Ongoing Ride" : ride.status}</span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-t2w-muted">
                        {ride.rideNumber} &middot; {ride.startLocation} &rarr; {ride.endLocation} &middot; {ride.distanceKm} km &middot; {ride.registeredRiders} registered
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Link href={`/ride/${ride.id}`} className="flex items-center gap-1.5 rounded-lg bg-t2w-surface-light px-3 py-2 text-xs text-t2w-muted transition-colors hover:text-white">
                        <Eye className="h-3.5 w-3.5" />View
                      </Link>
                      {isCoreOrAbove && (
                        <button onClick={() => loadRegistrations(ride.id)} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs transition-colors ${managingRegsRideId === ride.id ? "bg-blue-400/20 text-blue-400" : "bg-blue-400/10 text-blue-400 hover:bg-blue-400/20"}`}>
                          <ClipboardList className="h-3.5 w-3.5" />{managingRegsRideId === ride.id ? "Close" : "Manage"}
                        </button>
                      )}
                      {isCoreOrAbove && (
                        <button onClick={() => api.exportRideRegistrations(ride.id, ride.title)} className="flex items-center gap-1.5 rounded-lg bg-green-400/10 px-3 py-2 text-xs text-green-400 transition-colors hover:bg-green-400/20">
                          <Download className="h-3.5 w-3.5" />Export
                        </button>
                      )}
                      {isSuperAdmin && (
                        <button onClick={() => editingRideId === ride.id ? setEditingRideId(null) : startEditRide(ride.id)} className="flex items-center gap-1.5 rounded-lg bg-t2w-accent/10 px-3 py-2 text-xs text-t2w-accent transition-colors hover:bg-t2w-accent/20">
                          <Edit3 className="h-3.5 w-3.5" />{editingRideId === ride.id ? "Cancel" : "Edit"}
                        </button>
                      )}
                      {canDeleteRide && (
                        <button onClick={() => confirmDeleteRide(ride)} className="flex items-center gap-1.5 rounded-lg bg-red-400/10 px-3 py-2 text-xs text-red-400 transition-colors hover:bg-red-400/20">
                          <Trash2 className="h-3.5 w-3.5" />Delete
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Registrations Management Panel */}
                  {managingRegsRideId === ride.id && (
                    <div className="card mt-2 border-blue-400/30">
                      <h4 className="mb-4 flex items-center gap-2 font-semibold text-white">
                        <ClipboardList className="h-4 w-4 text-blue-400" />
                        Registrations ({rideRegistrations.length})
                      </h4>
                      {loadingRegs ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-5 w-5 animate-spin text-t2w-muted" />
                        </div>
                      ) : rideRegistrations.length === 0 ? (
                        <p className="text-sm text-t2w-muted py-4 text-center">No registrations yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {rideRegistrations.map((reg) => (
                            <div key={reg.id} className={`flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl p-3 border ${
                              reg.approvalStatus === "confirmed" ? "border-green-400/20 bg-green-400/5" :
                              reg.approvalStatus === "rejected" ? "border-red-400/20 bg-red-400/5" :
                              reg.approvalStatus === "dropout" ? "border-orange-400/20 bg-orange-400/5" :
                              "border-yellow-400/20 bg-yellow-400/5"
                            }`}>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-white text-sm truncate">{reg.riderName}</span>
                                  <span className={`shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-medium uppercase ${
                                    reg.approvalStatus === "confirmed" ? "bg-green-400/10 text-green-400" :
                                    reg.approvalStatus === "rejected" ? "bg-red-400/10 text-red-400" :
                                    reg.approvalStatus === "dropout" ? "bg-orange-400/10 text-orange-400" :
                                    "bg-yellow-400/10 text-yellow-400"
                                  }`}>{reg.approvalStatus === "dropout" ? "Drop-Out" : reg.approvalStatus}</span>
                                </div>
                                <p className="text-xs text-t2w-muted mt-0.5">
                                  {reg.email} &middot; {reg.phone || "No phone"} &middot; {new Date(reg.registeredAt).toLocaleDateString()}
                                </p>
                              </div>
                              <div className="flex gap-2 shrink-0">
                                {/* pending → Confirm / Reject */}
                                {reg.approvalStatus === "pending" && (
                                  <>
                                    <button
                                      onClick={() => updateRegStatus(ride.id, reg.id, "confirmed")}
                                      disabled={updatingRegId === reg.id}
                                      className="flex items-center gap-1 rounded-lg bg-green-400/10 px-3 py-1.5 text-xs text-green-400 transition-colors hover:bg-green-400/20 disabled:opacity-50"
                                    >
                                      {updatingRegId === reg.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                                      Confirm
                                    </button>
                                    <button
                                      onClick={() => updateRegStatus(ride.id, reg.id, "rejected")}
                                      disabled={updatingRegId === reg.id}
                                      className="flex items-center gap-1 rounded-lg bg-red-400/10 px-3 py-1.5 text-xs text-red-400 transition-colors hover:bg-red-400/20 disabled:opacity-50"
                                    >
                                      {updatingRegId === reg.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                                      Reject
                                    </button>
                                  </>
                                )}
                                {/* confirmed → Drop-Out */}
                                {reg.approvalStatus === "confirmed" && (
                                  <button
                                    onClick={() => updateRegStatus(ride.id, reg.id, "dropout")}
                                    disabled={updatingRegId === reg.id}
                                    className="flex items-center gap-1 rounded-lg bg-orange-400/10 px-3 py-1.5 text-xs text-orange-400 transition-colors hover:bg-orange-400/20 disabled:opacity-50"
                                  >
                                    {updatingRegId === reg.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserX className="h-3 w-3" />}
                                    Drop-Out
                                  </button>
                                )}
                                {/* dropout → Re-Confirm / Reject */}
                                {reg.approvalStatus === "dropout" && (
                                  <>
                                    <button
                                      onClick={() => updateRegStatus(ride.id, reg.id, "confirmed")}
                                      disabled={updatingRegId === reg.id}
                                      className="flex items-center gap-1 rounded-lg bg-green-400/10 px-3 py-1.5 text-xs text-green-400 transition-colors hover:bg-green-400/20 disabled:opacity-50"
                                    >
                                      {updatingRegId === reg.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                                      Re-Confirm
                                    </button>
                                    <button
                                      onClick={() => updateRegStatus(ride.id, reg.id, "rejected")}
                                      disabled={updatingRegId === reg.id}
                                      className="flex items-center gap-1 rounded-lg bg-red-400/10 px-3 py-1.5 text-xs text-red-400 transition-colors hover:bg-red-400/20 disabled:opacity-50"
                                    >
                                      {updatingRegId === reg.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                                      Reject
                                    </button>
                                  </>
                                )}
                                {/* rejected → Re-Confirm */}
                                {reg.approvalStatus === "rejected" && (
                                  <button
                                    onClick={() => updateRegStatus(ride.id, reg.id, "confirmed")}
                                    disabled={updatingRegId === reg.id}
                                    className="flex items-center gap-1 rounded-lg bg-green-400/10 px-3 py-1.5 text-xs text-green-400 transition-colors hover:bg-green-400/20 disabled:opacity-50"
                                  >
                                    {updatingRegId === reg.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                                    Re-Confirm
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Inline Edit Form */}
                  {editingRideId === ride.id && (
                    <div className="card mt-2 border-t2w-accent/30">
                      <h3 className="mb-4 flex items-center gap-2 font-display text-base font-bold text-white">
                        <Edit3 className="h-4 w-4 text-t2w-accent" />
                        Edit Ride: {ride.title}
                      </h3>
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="sm:col-span-2 lg:col-span-3"><label className="mb-1.5 block text-sm font-medium text-gray-300">Ride Title</label><input type="text" className="input-field" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} /></div>
                        <div><label className="mb-1.5 block text-sm font-medium text-gray-300">Ride Number</label><input type="text" className="input-field" value={editForm.rideNumber} onChange={(e) => setEditForm({ ...editForm, rideNumber: e.target.value })} /></div>
                        <div><label className="mb-1.5 block text-sm font-medium text-gray-300">Type</label><select className="input-field cursor-pointer" value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}><option value="day">Day Ride</option><option value="weekend">Weekend</option><option value="multi-day">Multi-Day</option><option value="expedition">Expedition</option></select></div>
                        <div><label className="mb-1.5 block text-sm font-medium text-gray-300">Status</label><select className="input-field cursor-pointer" value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}><option value="upcoming">Upcoming</option><option value="ongoing">Ongoing</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></div>
                        <div><label className="mb-1.5 block text-sm font-medium text-gray-300">Start Date</label><input type="date" className="input-field" value={editForm.startDate} onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })} /></div>
                        <div><label className="mb-1.5 block text-sm font-medium text-gray-300">End Date</label><input type="date" className="input-field" value={editForm.endDate} onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })} /></div>
                        <div><label className="mb-1.5 block text-sm font-medium text-gray-300">Difficulty</label><select className="input-field cursor-pointer" value={editForm.difficulty} onChange={(e) => setEditForm({ ...editForm, difficulty: e.target.value })}><option value="easy">Easy</option><option value="moderate">Moderate</option><option value="challenging">Challenging</option><option value="extreme">Extreme</option></select></div>
                        <div><label className="mb-1.5 block text-sm font-medium text-gray-300">Start Location Name</label><input type="text" className="input-field" value={editForm.startLocation} onChange={(e) => setEditForm({ ...editForm, startLocation: e.target.value })} /></div>
                        <div><label className="mb-1.5 block text-sm font-medium text-gray-300">Start Location Map Link</label><input type="url" className="input-field" placeholder="Google Maps URL" value={editForm.startLocationUrl} onChange={(e) => setEditForm({ ...editForm, startLocationUrl: e.target.value })} /></div>
                        <div><label className="mb-1.5 block text-sm font-medium text-gray-300">End Location Name</label><input type="text" className="input-field" value={editForm.endLocation} onChange={(e) => setEditForm({ ...editForm, endLocation: e.target.value })} /></div>
                        <div><label className="mb-1.5 block text-sm font-medium text-gray-300">End Location Map Link</label><input type="url" className="input-field" placeholder="Google Maps URL" value={editForm.endLocationUrl} onChange={(e) => setEditForm({ ...editForm, endLocationUrl: e.target.value })} /></div>
                        <div><label className="mb-1.5 block text-sm font-medium text-gray-300">Starting Point</label><input type="text" className="input-field" placeholder="Meetup location" value={editForm.startingPoint} onChange={(e) => setEditForm({ ...editForm, startingPoint: e.target.value })} /></div>
                        <div><label className="mb-1.5 block text-sm font-medium text-gray-300">Distance (km)</label><input type="number" className="input-field" value={editForm.distanceKm} onChange={(e) => setEditForm({ ...editForm, distanceKm: e.target.value })} /></div>
                        <div><label className="mb-1.5 block text-sm font-medium text-gray-300">Max Riders</label><input type="number" className="input-field" value={editForm.maxRiders} onChange={(e) => setEditForm({ ...editForm, maxRiders: e.target.value })} /></div>
                        <div><label className="mb-1.5 block text-sm font-medium text-gray-300">Registration Fee (₹)</label><input type="number" className="input-field" value={editForm.fee} onChange={(e) => setEditForm({ ...editForm, fee: e.target.value })} /></div>
                        <CrewAutocomplete label="Lead Rider" placeholder="Search by name, phone, or email" value={editForm.leadRider} onChange={(v) => setEditForm({ ...editForm, leadRider: v })} />
                        <CrewAutocomplete label="Sweep Rider" placeholder="Search by name, phone, or email" value={editForm.sweepRider} onChange={(v) => setEditForm({ ...editForm, sweepRider: v })} />
                        <CrewAutocomplete label="Organised By" placeholder="Search by name, phone, or email" value={editForm.organisedBy} onChange={(v) => setEditForm({ ...editForm, organisedBy: v })} />
                        <div><label className="mb-1.5 block text-sm font-medium text-gray-300">Meetup Time</label><input type="text" className="input-field" placeholder="e.g. 5:30 AM" value={editForm.meetupTime} onChange={(e) => setEditForm({ ...editForm, meetupTime: e.target.value })} /></div>
                        <div><label className="mb-1.5 block text-sm font-medium text-gray-300">Ride Start Time</label><input type="text" className="input-field" placeholder="e.g. 6:00 AM" value={editForm.rideStartTime} onChange={(e) => setEditForm({ ...editForm, rideStartTime: e.target.value })} /></div>
                        <CrewAutocomplete label="Accounts By" placeholder="Search by name, phone, or email" value={editForm.accountsBy} onChange={(v) => setEditForm({ ...editForm, accountsBy: v })} />
                        <div className="sm:col-span-2 lg:col-span-3"><label className="mb-1.5 block text-sm font-medium text-gray-300">Description</label><textarea rows={3} className="input-field resize-none" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} /></div>
                        <div className="sm:col-span-2 lg:col-span-3">
                          <label className="mb-1.5 block text-sm font-medium text-gray-300">Ride Highlights <span className="text-xs text-t2w-muted">(one per line)</span></label>
                          <textarea rows={4} className="input-field resize-none" placeholder={"Scenic coastal roads\nBreakfast at local cafe\nSunrise viewpoint stop\nGroup photo at destination"} value={editForm.highlights} onChange={(e) => setEditForm({ ...editForm, highlights: e.target.value })} />
                          {editForm.highlights.trim() && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {editForm.highlights.split("\n").filter((h) => h.trim()).map((h, i) => (
                                <span key={i} className="rounded-lg bg-t2w-accent/10 px-2.5 py-1 text-xs text-t2w-accent">{h.trim()}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        {/* Rider Management (Admin & Core Members) */}
                        {isCoreOrAbove && ridersLoaded && (
                          <div className="sm:col-span-2 lg:col-span-3">
                            <label className="mb-1.5 block text-sm font-medium text-gray-300">
                              <Users className="mr-1 inline h-4 w-4" />
                              Manage Riders ({editRideRiders.length})
                            </label>
                            <div className="flex gap-2 mb-3">
                              <div ref={riderInputWrapperRef} className="relative flex-1">
                                <input
                                  type="text"
                                  className="input-field w-full"
                                  placeholder="Enter rider name to add..."
                                  value={newRiderName}
                                  onChange={(e) => { setNewRiderName(e.target.value); setSelectedRiderIds({}); setRiderAddError(""); searchRidersForManage(e.target.value); }}
                                  onFocus={() => { if (riderSearchResults.length > 0) setRiderSearchDropdown(true); }}
                                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddRider(); } }}
                                />
                                {riderSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-t2w-muted" />}
                                {riderSearchDropdown && riderSearchResults.length > 0 && (
                                  <div className="absolute z-50 mt-1 w-full rounded-lg border border-t2w-border bg-t2w-surface shadow-xl max-h-48 overflow-y-auto">
                                    {riderSearchResults.map((r) => (
                                      <button
                                        key={r.id}
                                        type="button"
                                        className="w-full px-3 py-2 text-left text-sm hover:bg-t2w-surface-light transition-colors flex flex-col"
                                        onClick={() => { setNewRiderName(r.name); setSelectedRiderIds({ riderProfileId: r.riderProfileId, userId: r.userId }); setRiderSearchDropdown(false); }}
                                      >
                                        <span className="text-white font-medium">{r.name}</span>
                                        <span className="text-xs text-t2w-muted">{r.phone || "—"} / {r.email || "—"}</span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={handleAddRider}
                                disabled={!newRiderName.trim()}
                                className="flex items-center gap-1.5 rounded-xl bg-green-500/10 px-4 py-2.5 text-sm font-medium text-green-400 transition-colors hover:bg-green-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                <UserPlus className="h-4 w-4" />
                                Add
                              </button>
                            </div>
                            {riderAddError && (
                              <p className="text-sm text-red-400 mb-2">{riderAddError}</p>
                            )}
                            {editRideRiders.length > 0 ? (
                              <div className="max-h-60 overflow-y-auto rounded-xl border border-t2w-border bg-t2w-dark p-2 space-y-1">
                                {editRideRiders.map((rider, i) => (
                                  <div key={`${rider}-${i}`} className="flex items-center justify-between rounded-lg px-3 py-1.5 text-sm text-gray-300 hover:bg-white/5 group">
                                    <span>{i + 1}. {rider}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveRider(rider)}
                                      className="opacity-0 group-hover:opacity-100 flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-red-400 transition-all hover:bg-red-400/10"
                                    >
                                      <UserX className="h-3.5 w-3.5" />
                                      Remove
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-t2w-muted py-3 text-center">No riders added yet.</p>
                            )}
                          </div>
                        )}

                        {/* Registration Schedule (edit) */}
                        <div className="sm:col-span-2 lg:col-span-3 rounded-xl border border-t2w-border bg-t2w-bg p-4">
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input type="checkbox" checked={editRideRegSchedule.enabled} onChange={(e) => setEditRideRegSchedule((prev) => ({ ...prev, enabled: e.target.checked }))} className="h-4 w-4 rounded accent-t2w-accent" />
                            <span className="text-sm font-medium text-white">Staggered registration schedule</span>
                          </label>
                          <p className="mt-1 ml-7 text-xs text-t2w-muted">Open registration at different times for Core, T2W Rider, and Rider/Guest tiers.</p>
                          {editRideRegSchedule.enabled && (
                            <div className="mt-3 ml-7 grid gap-3 sm:grid-cols-3">
                              <div>
                                <label className="mb-1 block text-xs font-medium text-green-400">Core Members</label>
                                <input type="datetime-local" className="input-field text-sm" value={editRideRegSchedule.regOpenCore} onChange={(e) => setEditRideRegSchedule((prev) => ({ ...prev, regOpenCore: e.target.value }))} />
                              </div>
                              <div>
                                <label className="mb-1 block text-xs font-medium text-blue-400">T2W Riders</label>
                                <input type="datetime-local" className="input-field text-sm" value={editRideRegSchedule.regOpenT2w} onChange={(e) => setEditRideRegSchedule((prev) => ({ ...prev, regOpenT2w: e.target.value }))} />
                              </div>
                              <div>
                                <label className="mb-1 block text-xs font-medium text-yellow-400">Riders &amp; Guests</label>
                                <input type="datetime-local" className="input-field text-sm" value={editRideRegSchedule.regOpenRider} onChange={(e) => setEditRideRegSchedule((prev) => ({ ...prev, regOpenRider: e.target.value }))} />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Per-Ride Registration Form Settings (SuperAdmin only) */}
                        {isSuperAdmin && (
                          <div className="sm:col-span-2 lg:col-span-3 rounded-xl border border-t2w-border bg-t2w-bg p-4">
                            <label className="flex items-center gap-3 cursor-pointer">
                              <input type="checkbox" checked={editRideUseCustomSettings} onChange={(e) => setEditRideUseCustomSettings(e.target.checked)} className="h-4 w-4 rounded accent-t2w-accent" />
                              <span className="text-sm font-medium text-white">Custom registration form for this ride</span>
                            </label>
                            <p className="mt-1 ml-7 text-xs text-t2w-muted">Override global form settings for this ride only.</p>
                            {editRideUseCustomSettings && (
                              <div className="mt-3 ml-7 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                                {[
                                  { key: "address", label: "Address" },
                                  { key: "email", label: "Email" },
                                  { key: "phone", label: "Phone" },
                                  { key: "emergencyContact", label: "Emergency Contact" },
                                  { key: "bloodGroup", label: "Blood Group" },
                                  { key: "foodPreference", label: "Food Preference" },
                                  { key: "ridingType", label: "Riding Type" },
                                  { key: "referredBy", label: "Referred By" },
                                  { key: "vehicle", label: "Vehicle Details" },
                                  { key: "cancellationTerms", label: "Cancellation Terms" },
                                  { key: "paymentSection", label: "Payment Section" },
                                  { key: "indemnity", label: "Indemnity" },
                                ].map((f) => (
                                  <label key={f.key} className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={editRideFormCustomSettings.includes(f.key)} onChange={(e) => {
                                      setEditRideFormCustomSettings((prev) => e.target.checked ? [...prev, f.key] : prev.filter((k) => k !== f.key));
                                    }} className="h-3.5 w-3.5 rounded accent-t2w-accent" />
                                    <span className="text-xs text-gray-300">Hide {f.label}</span>
                                  </label>
                                ))}
                              </div>
                            )}

                            {/* Per-ride UPI ID override */}
                            <div className="mt-3 border-t border-t2w-border pt-3">
                              <label className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" checked={editRideUpiOverride} onChange={(e) => setEditRideUpiOverride(e.target.checked)} className="h-4 w-4 rounded accent-t2w-accent" />
                                <span className="text-sm font-medium text-white">Use a different UPI ID for this ride</span>
                              </label>
                              <p className="mt-1 ml-7 text-xs text-t2w-muted">Overrides the global UPI ID for this ride only. Riders will see this UPI ID + QR code in the registration form.</p>
                              {editRideUpiOverride && (
                                <div className="mt-3 ml-7 space-y-2">
                                  {editRideUpiIds.map((upi, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                      <input
                                        type="text"
                                        className="input-field w-28 shrink-0 text-xs"
                                        placeholder="Label (e.g. GPay)"
                                        value={upi.label}
                                        onChange={(e) => { const u = [...editRideUpiIds]; u[idx] = { ...u[idx], label: e.target.value }; setEditRideUpiIds(u); }}
                                      />
                                      <input
                                        type="text"
                                        className="input-field flex-1 text-xs font-mono"
                                        placeholder="UPI ID (e.g. name@upi)"
                                        value={upi.id}
                                        onChange={(e) => { const u = [...editRideUpiIds]; u[idx] = { ...u[idx], id: e.target.value }; setEditRideUpiIds(u); }}
                                      />
                                      {editRideUpiIds.length > 1 && (
                                        <button type="button" onClick={() => setEditRideUpiIds(editRideUpiIds.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-300 text-xs">✕</button>
                                      )}
                                    </div>
                                  ))}
                                  <button type="button" onClick={() => setEditRideUpiIds([...editRideUpiIds, { label: "", id: "" }])} className="text-xs text-t2w-accent hover:underline">+ Add another UPI ID</button>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="sm:col-span-2 lg:col-span-3 flex gap-3">
                          <button onClick={saveEditRide} disabled={savingEdit} className="btn-primary flex items-center gap-2">
                            {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            {savingEdit ? "Saving..." : "Save Changes"}
                          </button>
                          <button onClick={() => setEditingRideId(null)} className="rounded-xl px-5 py-2.5 text-sm font-medium text-gray-300 transition-all hover:bg-white/5 hover:text-white">Cancel</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Matrix Tab */}
        {activeTab === "matrix" && isSuperAdmin && (
          <ParticipationMatrix isSuperAdmin={isSuperAdmin} />
        )}

        {/* Merge Profiles Tab */}
        {activeTab === "merge" && isSuperAdmin && (
          <MergeProfiles />
        )}

        {/* Badges Tab - Super Admin only */}
        {activeTab === "badges" && isSuperAdmin && (
          <div className="space-y-6">
            <div className="card">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="flex items-center gap-2 font-display text-xl font-bold text-white">
                  <Award className="h-5 w-5 text-t2w-accent" />
                  Badge Tiers
                </h3>
                <p className="text-xs text-t2w-muted">{adminBadges.length} tiers configured</p>
              </div>
              <p className="mb-6 text-sm text-t2w-muted">
                Manage badge tiers that are automatically awarded to riders based on their total kilometers. Changes here apply immediately across the site.
              </p>
              {!badgesLoaded ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-t2w-accent" />
                </div>
              ) : adminBadges.length === 0 ? (
                <div className="py-12 text-center">
                  <Award className="mx-auto h-12 w-12 text-t2w-border" />
                  <p className="mt-3 text-t2w-muted">No badge tiers found. Run the seed script to initialize badges.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {adminBadges
                    .sort((a, b) => a.minKm - b.minKm)
                    .map((badge) => (
                    <div key={badge.id} className="rounded-xl border border-t2w-border bg-t2w-surface-light p-5">
                      {editingBadgeId === badge.id ? (
                        /* Edit mode */
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                              <label className="mb-1 block text-xs font-medium text-t2w-muted">Name</label>
                              <input
                                type="text"
                                value={badgeEditForm.name}
                                onChange={(e) => setBadgeEditForm({ ...badgeEditForm, name: e.target.value })}
                                className="w-full rounded-lg border border-t2w-border bg-t2w-dark px-3 py-2 text-sm text-white focus:border-t2w-accent/50 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-t2w-muted">Min KM Required</label>
                              <input
                                type="number"
                                value={badgeEditForm.minKm}
                                onChange={(e) => setBadgeEditForm({ ...badgeEditForm, minKm: e.target.value })}
                                className="w-full rounded-lg border border-t2w-border bg-t2w-dark px-3 py-2 text-sm text-white focus:border-t2w-accent/50 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-t2w-muted">Icon</label>
                              <select
                                value={badgeEditForm.icon}
                                onChange={(e) => setBadgeEditForm({ ...badgeEditForm, icon: e.target.value })}
                                className="w-full rounded-lg border border-t2w-border bg-t2w-dark px-3 py-2 text-sm text-white focus:border-t2w-accent/50 focus:outline-none"
                              >
                                <option value="shield">Shield</option>
                                <option value="award">Award</option>
                                <option value="star">Star</option>
                                <option value="gem">Gem</option>
                                <option value="zap">Zap</option>
                                <option value="crown">Crown</option>
                              </select>
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-t2w-muted">Color</label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="color"
                                  value={badgeEditForm.color}
                                  onChange={(e) => setBadgeEditForm({ ...badgeEditForm, color: e.target.value })}
                                  className="h-9 w-12 cursor-pointer rounded border border-t2w-border bg-t2w-dark"
                                />
                                <input
                                  type="text"
                                  value={badgeEditForm.color}
                                  onChange={(e) => setBadgeEditForm({ ...badgeEditForm, color: e.target.value })}
                                  className="flex-1 rounded-lg border border-t2w-border bg-t2w-dark px-3 py-2 text-sm text-white focus:border-t2w-accent/50 focus:outline-none"
                                />
                              </div>
                            </div>
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-t2w-muted">Description</label>
                            <textarea
                              value={badgeEditForm.description}
                              onChange={(e) => setBadgeEditForm({ ...badgeEditForm, description: e.target.value })}
                              rows={2}
                              className="w-full rounded-lg border border-t2w-border bg-t2w-dark px-3 py-2 text-sm text-white focus:border-t2w-accent/50 focus:outline-none"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={async () => {
                                setSavingBadge(true);
                                try {
                                  await api.badges.update(badge.id, {
                                    name: badgeEditForm.name,
                                    description: badgeEditForm.description,
                                    minKm: Number(badgeEditForm.minKm),
                                    icon: badgeEditForm.icon,
                                    color: badgeEditForm.color,
                                  });
                                  setAdminBadges((prev) =>
                                    prev.map((b) =>
                                      b.id === badge.id
                                        ? { ...b, name: badgeEditForm.name, description: badgeEditForm.description, minKm: Number(badgeEditForm.minKm), icon: badgeEditForm.icon, color: badgeEditForm.color }
                                        : b
                                    )
                                  );
                                  setEditingBadgeId(null);
                                } catch (err) {
                                  console.error("Failed to update badge:", err);
                                } finally {
                                  setSavingBadge(false);
                                }
                              }}
                              disabled={savingBadge}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-t2w-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-t2w-accent/80 disabled:opacity-50"
                            >
                              {savingBadge ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                              Save
                            </button>
                            <button
                              onClick={() => setEditingBadgeId(null)}
                              className="rounded-lg border border-t2w-border px-4 py-2 text-sm font-medium text-t2w-muted transition-colors hover:text-white"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* View mode */
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-4">
                            <div
                              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                              style={{ backgroundColor: `${badge.color}20` }}
                            >
                              <Award className="h-6 w-6" style={{ color: badge.color }} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-semibold text-white">{badge.name}</h4>
                                <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: `${badge.color}20`, color: badge.color }}>
                                  {badge.tier}
                                </span>
                              </div>
                              <p className="mt-1 text-sm text-t2w-muted">{badge.description}</p>
                              <p className="mt-1 text-xs text-t2w-muted">
                                Required: <span className="font-medium text-white">{badge.minKm.toLocaleString()} km</span>
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setEditingBadgeId(badge.id);
                              setBadgeEditForm({
                                name: badge.name,
                                description: badge.description,
                                minKm: String(badge.minKm),
                                icon: badge.icon,
                                color: badge.color,
                              });
                            }}
                            className="shrink-0 rounded-lg border border-t2w-border p-2 text-t2w-muted transition-colors hover:border-t2w-accent/30 hover:text-white"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
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
                          By {blog.authorName} &middot;{" "}
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

        {/* ── Form Settings Tab (SuperAdmin) ── */}
        {activeTab === "form-settings" && isSuperAdmin && (
          <div>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="font-display text-xl font-bold text-white">Registration Form Settings</h3>
                <p className="mt-1 text-sm text-t2w-muted">Customize the ride registration form fields, policies, and payment details</p>
              </div>
              <button
                onClick={saveFormSettings}
                disabled={savingFormSettings}
                className="btn-primary flex items-center gap-2"
              >
                {savingFormSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {savingFormSettings ? "Saving..." : "Save Settings"}
              </button>
            </div>

            {!formSettingsLoaded ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-t2w-accent" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Toggle Form Fields */}
                <div className="card">
                  <h4 className="mb-4 flex items-center gap-2 font-display text-base font-bold text-white">
                    <Edit3 className="h-5 w-5 text-t2w-accent" />
                    Toggle Registration Form Fields
                  </h4>
                  <p className="mb-4 text-sm text-t2w-muted">Enable or disable any field on the registration form. Rider Name is always required.</p>
                  <div className="space-y-3">
                    {[
                      { key: "address", label: "Address", desc: "Full address field" },
                      { key: "email", label: "Email", desc: "Rider email address" },
                      { key: "phone", label: "Phone / WhatsApp", desc: "Contact phone number" },
                      { key: "emergencyContact", label: "Emergency Contact", desc: "Emergency contact name, relation & phone" },
                      { key: "bloodGroup", label: "Blood Group", desc: "Blood group selection" },
                      { key: "foodPreference", label: "Food Preference", desc: "Vegetarian / Non-vegetarian selection" },
                      { key: "ridingType", label: "Riding Type", desc: "Solo / Rider with Pillion / Pillion Rider" },
                      { key: "referredBy", label: "Referred By", desc: "Who referred the rider to T2W" },
                      { key: "vehicle", label: "Vehicle Details", desc: "Vehicle model and registration number" },
                    ].map((field) => (
                      <div key={field.key} className="flex items-center justify-between rounded-xl border border-t2w-border bg-t2w-bg px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-white">{field.label}</p>
                          <p className="text-xs text-t2w-muted">{field.desc}</p>
                        </div>
                        <button onClick={() => toggleHiddenField(field.key)} className="text-t2w-accent">
                          {formSettings.hiddenFields.includes(field.key) ? (
                            <ToggleLeft className="h-8 w-8 text-t2w-muted" />
                          ) : (
                            <ToggleRight className="h-8 w-8 text-t2w-accent" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Sections toggles */}
                  <div className="mt-4 pt-4 border-t border-t2w-border">
                    <p className="mb-3 text-sm font-medium text-t2w-accent">Form Sections</p>
                    <div className="space-y-3">
                      {[
                        { key: "cancellationTerms", label: "Cancellation & Refund Terms", desc: "Show cancellation policy and agreement checkbox" },
                        { key: "paymentSection", label: "Payment Section", desc: "Show payment details, UPI, bank info, and screenshot/transaction input" },
                        { key: "indemnity", label: "Acknowledgement & Indemnity", desc: "Show risk acknowledgement and indemnity agreement" },
                      ].map((field) => (
                        <div key={field.key} className="flex items-center justify-between rounded-xl border border-t2w-border bg-t2w-bg px-4 py-3">
                          <div>
                            <p className="text-sm font-medium text-white">{field.label}</p>
                            <p className="text-xs text-t2w-muted">{field.desc}</p>
                          </div>
                          <button onClick={() => toggleHiddenField(field.key)} className="text-t2w-accent">
                            {formSettings.hiddenFields.includes(field.key) ? (
                              <ToggleLeft className="h-8 w-8 text-t2w-muted" />
                            ) : (
                              <ToggleRight className="h-8 w-8 text-t2w-accent" />
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Optional Add-ons */}
                  <div className="mt-4 pt-4 border-t border-t2w-border">
                    <p className="mb-3 text-sm font-medium text-t2w-accent">Optional Add-ons</p>
                    <div className="flex items-center justify-between rounded-xl border border-t2w-border bg-t2w-bg px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-white">T-Shirt Size Collection</p>
                        <p className="text-xs text-t2w-muted">Enable to collect T-shirt sizes (XS, S, M, L, XL, XXL, XXXL) during ride registration</p>
                      </div>
                      <button onClick={() => setFormSettings({ ...formSettings, enableTshirtSize: !formSettings.enableTshirtSize })} className="text-t2w-accent">
                        {formSettings.enableTshirtSize ? (
                          <ToggleRight className="h-8 w-8 text-t2w-accent" />
                        ) : (
                          <ToggleLeft className="h-8 w-8 text-t2w-muted" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Cancellation & Refund Text */}
                <div className="card">
                  <h4 className="mb-4 flex items-center gap-2 font-display text-base font-bold text-white">
                    <FileText className="h-5 w-5 text-t2w-accent" />
                    Cancellation & Refund Policy
                  </h4>
                  <p className="mb-3 text-sm text-t2w-muted">
                    Edit the cancellation text shown to riders during registration. Use <code className="rounded bg-t2w-surface-light px-1.5 py-0.5 text-xs text-t2w-accent">__text__</code> for bold headings and numbered lines for policy points.
                  </p>
                  <textarea
                    rows={6}
                    className="input-field font-mono text-sm"
                    value={formSettings.cancellationText}
                    onChange={(e) => setFormSettings({ ...formSettings, cancellationText: e.target.value })}
                    placeholder="Enter cancellation and refund policy text..."
                  />
                </div>

                {/* Payment Details */}
                <div className="card">
                  <h4 className="mb-4 flex items-center gap-2 font-display text-base font-bold text-white">
                    <TrendingUp className="h-5 w-5 text-t2w-accent" />
                    Payment Details
                  </h4>
                  <div className="space-y-4">
                    {/* Payment Verification Mode */}
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-300">Payment Verification Mode</label>
                      <p className="mb-2 text-xs text-t2w-muted">How should riders verify their payment?</p>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        {([
                          { value: "screenshot", label: "Screenshot Upload", desc: "Upload payment screenshot" },
                          { value: "transaction_id", label: "Transaction ID", desc: "Enter UPI transaction number" },
                          { value: "both", label: "Both Options", desc: "Screenshot or transaction ID" },
                        ] as const).map((mode) => (
                          <button
                            key={mode.value}
                            onClick={() => setFormSettings({ ...formSettings, paymentMode: mode.value })}
                            className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                              formSettings.paymentMode === mode.value
                                ? "border-t2w-accent bg-t2w-accent/10"
                                : "border-t2w-border bg-t2w-bg hover:border-t2w-accent/30"
                            }`}
                          >
                            <p className={`text-sm font-medium ${formSettings.paymentMode === mode.value ? "text-t2w-accent" : "text-white"}`}>{mode.label}</p>
                            <p className="text-xs text-t2w-muted">{mode.desc}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Multiple UPI IDs */}
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <label className="text-sm font-medium text-gray-300">UPI IDs</label>
                        <button
                          onClick={() => setFormSettings({ ...formSettings, upiIds: [...formSettings.upiIds, { label: "", id: "" }] })}
                          className="flex items-center gap-1 rounded-lg bg-t2w-accent/10 px-2.5 py-1.5 text-xs font-medium text-t2w-accent transition-colors hover:bg-t2w-accent/20"
                        >
                          <Plus className="h-3.5 w-3.5" /> Add UPI ID
                        </button>
                      </div>
                      <div className="space-y-2">
                        {formSettings.upiIds.map((upi, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <input
                              type="text"
                              className="input-field flex-1"
                              placeholder="Label (e.g. GPay, PhonePe)"
                              value={upi.label}
                              onChange={(e) => {
                                const updated = [...formSettings.upiIds];
                                updated[idx] = { ...updated[idx], label: e.target.value };
                                setFormSettings({ ...formSettings, upiIds: updated });
                              }}
                            />
                            <input
                              type="text"
                              className="input-field flex-[2]"
                              placeholder="e.g. taleson2wheels@upi"
                              value={upi.id}
                              onChange={(e) => {
                                const updated = [...formSettings.upiIds];
                                updated[idx] = { ...updated[idx], id: e.target.value };
                                setFormSettings({ ...formSettings, upiIds: updated });
                              }}
                            />
                            {formSettings.upiIds.length > 1 && (
                              <button
                                onClick={() => setFormSettings({ ...formSettings, upiIds: formSettings.upiIds.filter((_, i) => i !== idx) })}
                                className="rounded-lg p-2 text-red-400 transition-colors hover:bg-red-400/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Multiple Bank Accounts */}
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <label className="text-sm font-medium text-gray-300">Bank Transfer Details</label>
                        <button
                          onClick={() => setFormSettings({ ...formSettings, bankAccounts: [...formSettings.bankAccounts, { label: "", details: "" }] })}
                          className="flex items-center gap-1 rounded-lg bg-t2w-accent/10 px-2.5 py-1.5 text-xs font-medium text-t2w-accent transition-colors hover:bg-t2w-accent/20"
                        >
                          <Plus className="h-3.5 w-3.5" /> Add Bank Account
                        </button>
                      </div>
                      <div className="space-y-2">
                        {formSettings.bankAccounts.map((bank, idx) => (
                          <div key={idx} className="flex items-start gap-2">
                            <input
                              type="text"
                              className="input-field w-40 shrink-0"
                              placeholder="Label (e.g. SBI, HDFC)"
                              value={bank.label}
                              onChange={(e) => {
                                const updated = [...formSettings.bankAccounts];
                                updated[idx] = { ...updated[idx], label: e.target.value };
                                setFormSettings({ ...formSettings, bankAccounts: updated });
                              }}
                            />
                            <textarea
                              rows={2}
                              className="input-field flex-1 text-sm"
                              placeholder="Account Name, Account No, IFSC, etc."
                              value={bank.details}
                              onChange={(e) => {
                                const updated = [...formSettings.bankAccounts];
                                updated[idx] = { ...updated[idx], details: e.target.value };
                                setFormSettings({ ...formSettings, bankAccounts: updated });
                              }}
                            />
                            {formSettings.bankAccounts.length > 1 && (
                              <button
                                onClick={() => setFormSettings({ ...formSettings, bankAccounts: formSettings.bankAccounts.filter((_, i) => i !== idx) })}
                                className="mt-2 rounded-lg p-2 text-red-400 transition-colors hover:bg-red-400/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Preview */}
                <div className="card border-t2w-accent/20">
                  <h4 className="mb-4 flex items-center gap-2 font-display text-base font-bold text-white">
                    <Eye className="h-5 w-5 text-t2w-accent" />
                    Cancellation Text Preview
                  </h4>
                  <div className="rounded-xl border border-t2w-border bg-t2w-bg p-4 text-sm text-t2w-muted leading-relaxed whitespace-pre-line">
                    {formSettings.cancellationText.split("\n").map((line, i) => {
                      if (line.startsWith("__") && line.endsWith("__")) return <p key={i} className="mt-2 font-semibold text-t2w-accent">{line.replace(/__/g, "")}</p>;
                      if (/^\d+\./.test(line)) return <p key={i} className="ml-3 mt-1 text-gray-300"><span className="text-t2w-accent font-medium">{line.split(":")[0]}:</span>{line.includes(":") ? line.slice(line.indexOf(":") + 1) : ""}</p>;
                      return <p key={i} className={i > 0 ? "mt-1" : ""}>{line}</p>;
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        {/* Activity Tab - Super Admin only */}
        {activeTab === "activity" && isSuperAdmin && (
          <div className="space-y-6">
            <div className="card">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="flex items-center gap-2 font-display text-xl font-bold text-white">
                  <Activity className="h-5 w-5 text-t2w-accent" />
                  Activity Log
                </h3>
                <p className="text-xs text-t2w-muted">{activityLog.length} entries</p>
              </div>
              {activityLog.length === 0 ? (
                <div className="py-12 text-center">
                  <Clock className="mx-auto h-12 w-12 text-t2w-border" />
                  <p className="mt-3 text-t2w-muted">No activity logged yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activityLog.map((entry) => (
                    <div key={entry.id} className="flex items-start gap-4 rounded-xl border border-t2w-border bg-t2w-surface-light p-4">
                      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        entry.action.includes("deleted") || entry.action.includes("rejected")
                          ? "bg-red-400/10 text-red-400"
                          : entry.action.includes("approved") || entry.action.includes("created")
                          ? "bg-green-400/10 text-green-400"
                          : entry.action.includes("edited") || entry.action.includes("changed") || entry.action.includes("saved")
                          ? "bg-blue-400/10 text-blue-400"
                          : "bg-t2w-accent/10 text-t2w-accent"
                      }`}>
                        {entry.action.includes("deleted") ? <Trash2 className="h-4 w-4" /> :
                         entry.action.includes("approved") ? <CheckCircle className="h-4 w-4" /> :
                         entry.action.includes("rejected") ? <XCircle className="h-4 w-4" /> :
                         entry.action.includes("created") ? <Plus className="h-4 w-4" /> :
                         entry.action.includes("edited") || entry.action.includes("changed") ? <Edit3 className="h-4 w-4" /> :
                         <Settings className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white">
                          {entry.details}
                          {entry.details?.includes("[ROLLED BACK]") && (
                            <span className="ml-2 rounded bg-yellow-400/10 px-1.5 py-0.5 text-xs text-yellow-400">Rolled Back</span>
                          )}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-t2w-muted">
                          <span>by {entry.performedByName}</span>
                          <span>&middot;</span>
                          <span>{new Date(entry.timestamp).toLocaleString()}</span>
                        </div>
                      </div>
                      {entry.rollbackData !== undefined && entry.rollbackData !== null && !entry.details?.includes("[ROLLED BACK]") && (
                        <button
                          onClick={async () => {
                            if (rollingBack) return;
                            setRollingBack(entry.id);
                            try {
                              await api.activityLog.rollback(entry.id);
                              const data = await api.activityLog.list();
                              setActivityLog(data.entries);
                              // Refresh relevant data
                              const [usersData, ridesData] = await Promise.all([
                                api.users.list("status=active").catch(() => null),
                                api.rides.list().catch(() => null),
                              ]);
                              if (usersData) setAllUsers((usersData as { users: AllUser[] }).users);
                              if (ridesData) setRides((ridesData as { rides: AdminRide[] }).rides);
                            } catch (err) {
                              console.error("Rollback failed:", err);
                            } finally {
                              setRollingBack(null);
                            }
                          }}
                          disabled={rollingBack === entry.id}
                          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-yellow-400/10 px-3 py-2 text-xs font-medium text-yellow-400 transition-colors hover:bg-yellow-400/20 disabled:opacity-50"
                          title="Rollback this action"
                        >
                          {rollingBack === entry.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                          Rollback
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        {/* Arena Settings Tab - Super Admin only */}
        {activeTab === "arena" && isSuperAdmin && (
          <ArenaSettingsTab />
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-2xl border border-t2w-border bg-t2w-surface p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-400/10">
                <AlertTriangle className="h-5 w-5 text-red-400" />
              </div>
              <h3 className="font-display text-lg font-bold text-white">Confirm Delete</h3>
            </div>
            <p className="mb-6 text-sm text-t2w-muted">
              Are you sure you want to delete <span className="font-semibold text-white">{deleteConfirm.name}</span>?
              {isSuperAdmin && " You can rollback this action from the Activity tab."}
              {!isSuperAdmin && " This action cannot be undone."}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 rounded-xl border border-t2w-border bg-t2w-surface-light px-4 py-2.5 text-sm font-medium text-t2w-muted transition-colors hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (deleteConfirm.type === "ride") executeDeleteRide();
                  else if (deleteConfirm.type === "user") executeDeleteUser();
                  else if (deleteConfirm.type === "bulk-users") executeDeleteBulkUsers();
                }}
                className="flex-1 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
