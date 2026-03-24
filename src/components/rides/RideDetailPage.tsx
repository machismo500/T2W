"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Calendar,
  MapPin,
  Users,
  ArrowLeft,
  Gauge,
  Route,
  Clock,
  Star,
  Shield,
  CheckCircle,
  AlertTriangle,
  Bike,
  User,
  IndianRupee,
  Loader2,
  ImagePlus,
  Send,
  Phone,
  Mail,
  Heart,
  Droplets,
  Car,
  FileText,
  XCircle,
  ChevronDown,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";
import type { RidePost } from "@/types";

// Cache for rider name->id, avatar, and role lookups (loaded once from API)
type RiderLookupCache = {
  nameToId: Record<string, string>;
  idToAvatar: Record<string, string>;
  idToRole: Record<string, string>;
  nameToRole: Record<string, string>; // normalized name -> role for role tag lookup
};
let _riderCache: RiderLookupCache | null = null;
let _riderCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Normalize a name for fuzzy matching: lowercase, strip titles/periods, collapse whitespace
function normalizeName(n: string): string {
  return n
    .toLowerCase()
    .replace(/\(.*?\)/g, "") // remove parentheticals like "(Rajnish's Son)"
    .replace(/^dr\.?\s*/i, "") // strip Dr. prefix
    .replace(/\./g, "") // remove periods
    .replace(/\s+/g, " ") // collapse multiple spaces
    .trim();
}

// Extract first name
function firstName(n: string): string {
  return normalizeName(n).split(" ")[0];
}

async function loadRiderCache(): Promise<RiderLookupCache> {
  if (_riderCache && Date.now() - _riderCacheTime < CACHE_TTL) return _riderCache;
  try {
    const data = await api.riders.list();
    const nameToId: Record<string, string> = {};
    const idToAvatar: Record<string, string> = {};
    const idToRole: Record<string, string> = {};
    const nameToRole: Record<string, string> = {};
    const riders = (data.riders || []) as Array<{ id: string; name: string; avatarUrl?: string; userRole?: string }>;

    // Also load localStorage-cached avatars as fallback (for when server upload failed on Vercel)
    let localAvatars: Record<string, string> = {};
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("t2w_avatars");
        if (raw) localAvatars = JSON.parse(raw);
      } catch { /* ignore */ }
    }

    // Track first-name uniqueness for first-name-only matching
    const firstNameCount: Record<string, number> = {};
    const firstNameToFullName: Record<string, string> = {};
    for (const r of riders) {
      const fn = firstName(r.name);
      firstNameCount[fn] = (firstNameCount[fn] || 0) + 1;
      firstNameToFullName[fn] = r.name;
    }

    for (const r of riders) {
      const exact = r.name.toLowerCase().trim();
      const normalized = normalizeName(r.name);
      nameToId[exact] = r.id;
      if (normalized !== exact) nameToId[normalized] = r.id;

      // Also index by first name if unique
      const fn = firstName(r.name);
      if (firstNameCount[fn] === 1) {
        nameToId[fn] = r.id;
      }

      // Index partial forms: "Firstname L" matching "Firstname Lastname"
      const parts = normalized.split(" ");
      if (parts.length >= 2) {
        // "firstname l" for "firstname lastname"
        nameToId[parts[0] + " " + parts[parts.length - 1][0]] = r.id;
        // If 3+ parts, index without middle: "first last"
        if (parts.length >= 3) {
          nameToId[parts[0] + " " + parts[parts.length - 1]] = r.id;
        }
      }

      // Avatar: prefer DB value, fallback to shared localStorage, then legacy localStorage
      const legacyAvatar = (typeof window !== "undefined") ? localStorage.getItem(`t2w_avatar_${r.id}`) : null;
      const avatar = r.avatarUrl || localAvatars[r.id] || legacyAvatar;
      if (avatar) {
        idToAvatar[r.id] = avatar;
      }
      // Track user role for tagging (by ID and by name)
      if (r.userRole) {
        idToRole[r.id] = r.userRole;
        // Index by all name forms so crew name matching works
        nameToRole[r.name.toLowerCase().trim()] = r.userRole;
        nameToRole[normalizeName(r.name)] = r.userRole;
        const fn = firstName(r.name);
        if (firstNameCount[fn] === 1) {
          nameToRole[fn] = r.userRole;
        }
      }
    }
    _riderCache = { nameToId, idToAvatar, idToRole, nameToRole };
    _riderCacheTime = Date.now();
    return _riderCache;
  } catch {
    return { nameToId: {}, idToAvatar: {}, idToRole: {}, nameToRole: {} };
  }
}

// Helper: look up a rider profile link by name (uses API-loaded cache)
function getRiderLink(name: string, nameToId: Record<string, string>): string | null {
  if (!name) return null;
  // Try exact lowercase
  const key = name.toLowerCase().trim();
  if (nameToId[key]) return `/rider/${nameToId[key]}`;
  // Try normalized
  const norm = normalizeName(name);
  if (nameToId[norm]) return `/rider/${nameToId[norm]}`;
  // Try first name only
  const fn = firstName(name);
  if (nameToId[fn]) return `/rider/${nameToId[fn]}`;
  return null;
}

// Helper: get rider id from name
function getRiderId(name: string, nameToId: Record<string, string>): string | null {
  if (!name) return null;
  const key = name.toLowerCase().trim();
  if (nameToId[key]) return nameToId[key];
  const norm = normalizeName(name);
  if (nameToId[norm]) return nameToId[norm];
  const fn = firstName(name);
  if (nameToId[fn]) return nameToId[fn];
  return null;
}

// Role tag configuration
const ROLE_TAG_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  superadmin: { label: "Super Admin", bg: "bg-red-500/20", text: "text-red-400" },
  core_member: { label: "Core", bg: "bg-t2w-accent/20", text: "text-t2w-accent" },
  t2w_rider: { label: "T2W Rider", bg: "bg-blue-500/20", text: "text-blue-400" },
  rider: { label: "Rider", bg: "bg-gray-500/20", text: "text-gray-400" },
};

// Helper: get the role for a rider by name or ID
function getRoleByNameOrId(
  name: string,
  riderId: string | null,
  idToRole: Record<string, string>,
  nameToRoleMap: Record<string, string>
): string | null {
  // Check by ID first
  if (riderId) {
    const r = idToRole[riderId];
    if (r) return r;
  }
  // Check by name (multiple forms)
  if (name) {
    const key = name.toLowerCase().trim();
    const nr = nameToRoleMap[key];
    if (nr) return nr;
    const norm = normalizeName(name);
    const nr2 = nameToRoleMap[norm];
    if (nr2) return nr2;
    const fn = firstName(name);
    const nr3 = nameToRoleMap[fn];
    if (nr3) return nr3;
  }
  return null;
}

// Helper: render a role tag badge
function RoleTag({ role }: { role: string | null }) {
  if (!role) return null;
  const config = ROLE_TAG_CONFIG[role];
  if (!config) return null;
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full ${config.bg} px-1.5 py-0.5 text-[10px] font-semibold ${config.text}`}>
      {config.label}
    </span>
  );
}

// Helper: build a Google Maps search URL for a location
function getGoogleMapsUrl(location: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
}

interface Ride {
  id: string;
  title: string;
  rideNumber: string;
  type: string;
  status: string;
  startDate: string;
  endDate: string;
  startLocation: string;
  startLocationUrl?: string;
  endLocation: string;
  endLocationUrl?: string;
  route: string[];
  highlights: string[];
  distanceKm: number;
  maxRiders: number;
  registeredRiders: number;
  activeRegistrations?: number;
  confirmedRiderNames?: string[];
  difficulty: string;
  description: string;
  fee: number;
  leadRider: string;
  sweepRider: string;
  registrations: unknown[];
  riders?: string[];
  posterUrl?: string;
  accountsBy?: string;
  organisedBy?: string;
  meetupTime?: string;
  rideStartTime?: string;
  startingPoint?: string;
  regFormSettings?: Record<string, unknown> | null;
  regOpenCore?: string | null;
  regOpenT2w?: string | null;
  regOpenRider?: string | null;
  participations?: {
    id: string;
    riderProfileId: string;
    riderName: string;
    riderAvatar?: string;
    droppedOut: boolean;
    points: number;
  }[];
}

/** Check if registration is open for the current user based on staggered schedule */
function getRegistrationStatus(
  ride: Ride,
  userRole: string | undefined
): { open: boolean; opensAt: Date | null } {
  // If no schedule is set at all, registration is open for everyone
  if (!ride.regOpenCore && !ride.regOpenT2w && !ride.regOpenRider) {
    return { open: true, opensAt: null };
  }

  const now = new Date();

  // SuperAdmin and Core members use regOpenCore
  if (userRole === "superadmin" || userRole === "core_member") {
    if (!ride.regOpenCore) return { open: true, opensAt: null };
    const openDate = new Date(ride.regOpenCore);
    return { open: now >= openDate, opensAt: now < openDate ? openDate : null };
  }

  // T2W Riders use regOpenT2w
  if (userRole === "t2w_rider") {
    if (!ride.regOpenT2w) return { open: true, opensAt: null };
    const openDate = new Date(ride.regOpenT2w);
    return { open: now >= openDate, opensAt: now < openDate ? openDate : null };
  }

  // Regular riders and guests (not logged in or role=rider) use regOpenRider
  if (!ride.regOpenRider) return { open: true, opensAt: null };
  const openDate = new Date(ride.regOpenRider);
  return { open: now >= openDate, opensAt: now < openDate ? openDate : null };
}

export function RideDetailPage({ rideId }: { rideId: string }) {
  const { user, canEditRide, canApproveContent, isSuperAdmin, isT2WRiderOrAbove, isLoggedIn } = useAuth();
  const [ride, setRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRegistration, setShowRegistration] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [confirmationCode, setConfirmationCode] = useState<string | null>(null);
  const [approvalStatus, setApprovalStatus] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const posterInputRef = useRef<HTMLInputElement>(null);
  const [riderNameToId, setRiderNameToId] = useState<Record<string, string>>({});
  const [riderIdToAvatar, setRiderIdToAvatar] = useState<Record<string, string>>({});
  const [riderIdToRole, setRiderIdToRole] = useState<Record<string, string>>({});
  const [riderNameToRole, setRiderNameToRole] = useState<Record<string, string>>({});

  // Registration form state
  const [regForm, setRegForm] = useState({
    riderName: "",
    address: "",
    email: "",
    phone: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    bloodGroup: "",
    referredBy: "",
    foodPreference: "" as "vegetarian" | "non-vegetarian" | "",
    ridingType: "" as "solo" | "rider-with-pillion" | "pillion-rider" | "",
    vehicleModel: "",
    vehicleRegNumber: "",
    tshirtSize: "" as "XS" | "S" | "M" | "L" | "XL" | "XXL" | "XXXL" | "",
    agreedCancellationTerms: false,
    agreedIndemnity: false,
    paymentScreenshot: "",
    upiTransactionId: "",
  });
  const paymentInputRef = useRef<HTMLInputElement>(null);
  const [formSettings, setFormSettings] = useState<Record<string, unknown>>({});

  // Ride posts
  const [ridePosts, setRidePosts] = useState<RidePost[]>([]);
  const [taleText, setTaleText] = useState("");
  const [postingTale, setPostingTale] = useState(false);
  const [taleSubmitted, setTaleSubmitted] = useState(false);

  // Motorcycles from user profile
  const [userMotorcycles, setUserMotorcycles] = useState<{ id: string; make: string; model: string; year: number; cc: number; color: string; nickname?: string }[]>([]);

  // Pre-fill registration form from user data and previously saved registration data
  useEffect(() => {
    if (user) {
      // Load previously saved registration data for this user
      const savedKey = `t2w_reg_prefill_${user.id}`;
      let saved: Record<string, string> = {};
      try {
        const raw = localStorage.getItem(savedKey);
        if (raw) saved = JSON.parse(raw);
      } catch { /* ignore */ }

      setRegForm((prev) => ({
        ...prev,
        riderName: prev.riderName || saved.riderName || user.name,
        address: prev.address || saved.address || "",
        email: prev.email || saved.email || user.email,
        phone: prev.phone || saved.phone || user.phone || "",
        emergencyContactName: prev.emergencyContactName || saved.emergencyContactName || "",
        emergencyContactPhone: prev.emergencyContactPhone || saved.emergencyContactPhone || "",
        bloodGroup: prev.bloodGroup || saved.bloodGroup || "",
        referredBy: prev.referredBy || saved.referredBy || "",
        vehicleModel: prev.vehicleModel || saved.vehicleModel || "",
        vehicleRegNumber: prev.vehicleRegNumber || saved.vehicleRegNumber || "",
      }));

      // Fetch user's motorcycles
      api.motorcycles.list().then((data) => {
        const motos = (data as { motorcycles: typeof userMotorcycles }).motorcycles || [];
        setUserMotorcycles(motos);
      }).catch(() => { /* ignore if not logged in */ });
    }
  }, [user]);

  // Load form settings: per-ride settings take priority, then global settings as fallback
  useEffect(() => {
    api.regFormSettings.get().then((globalSettings) => {
      if (ride?.regFormSettings && typeof ride.regFormSettings === "object") {
        // Merge: per-ride overrides global
        setFormSettings({ ...globalSettings, ...(ride.regFormSettings as Record<string, unknown>) });
      } else {
        setFormSettings(globalSettings);
      }
    });
  }, [ride]);

  // Load rider name-to-id map and avatars for linking
  useEffect(() => {
    loadRiderCache().then((cache) => {
      setRiderNameToId(cache.nameToId);
      setRiderIdToAvatar(cache.idToAvatar);
      setRiderIdToRole(cache.idToRole);
      setRiderNameToRole(cache.nameToRole);
    });
  }, []);

  const cancellationText = (formSettings.cancellationText as string) ||
    "Post registration, if you cancel\n1. Partial Refund: If the stay owner waives the booking charge or if a replacement rider is found, a cancellation fee of \u20B9500 will be deducted and the remaining amount will be refunded to you.\n2. No Refund: If a replacement rider is not available and the stay owner charges for your reserved slot, we will be unable to offer a refund.";
  const upiIds = (formSettings.upiIds as { label: string; id: string }[]) || [];
  const bankAccounts = (formSettings.bankAccounts as { label: string; details: string }[]) || [];
  // Fallback to legacy single UPI/bank if no arrays
  const effectiveUpiIds = upiIds.length > 0 ? upiIds : [{ label: "", id: (formSettings.upiId as string) || "taleson2wheels@upi" }];
  const effectiveBankAccounts = bankAccounts.length > 0 ? bankAccounts : [{ label: "", details: (formSettings.bankDetails as string) || "Contact admin for details" }];
  const hiddenFields = (formSettings.hiddenFields as string[]) || [];
  const enableTshirtSize = Boolean(formSettings.enableTshirtSize);
  const paymentMode = (formSettings.paymentMode as string) || "screenshot";

  const [posterUploading, setPosterUploading] = useState(false);

  const compressPoster = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const MAX = 1600; // max dimension for posters
        let w = img.width;
        let h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else { w = Math.round(w * MAX / h); h = MAX; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Canvas not supported")); return; }
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
        resolve(dataUrl);
      };
      img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("Failed to load image")); };
      img.src = objectUrl;
    });
  };

  const handlePosterUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      alert("Image must be under 15MB");
      return;
    }
    setPosterUploading(true);
    try {
      // Compress client-side to stay within Vercel's 4.5MB body limit
      const compressedDataUrl = await compressPoster(file);
      // Upload compressed data URL to server
      const formData = new FormData();
      formData.append("dataUrl", compressedDataUrl);
      formData.append("type", "poster");
      formData.append("targetId", rideId);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      const url = data.url as string;
      // Save poster URL to ride record
      await api.rides.update(rideId, { posterUrl: url });
      setPosterUrl(url);
    } catch {
      alert("Failed to upload poster. Please try again.");
    }
    setPosterUploading(false);
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      api.rides.get(rideId),
      api.ridePosts.listApproved(rideId),
    ])
      .then(([rideData, postsData]) => {
        if (cancelled) return;
        const result = rideData as { ride: Ride };
        const r = result.ride;
        if (typeof r.route === "string") {
          r.route = JSON.parse(r.route);
        }
        if (typeof r.highlights === "string") {
          r.highlights = JSON.parse(r.highlights);
        }
        setRide(r);
        // Check if current user is already registered (from DB)
        const fullResult = rideData as { ride: Ride & { currentUserRegistered?: boolean; currentUserConfirmationCode?: string | null; currentUserApprovalStatus?: string | null } };
        if (fullResult.ride?.currentUserRegistered) {
          setRegistered(true);
          setConfirmationCode(fullResult.ride.currentUserConfirmationCode || null);
          setApprovalStatus(fullResult.ride.currentUserApprovalStatus || "pending");
        }
        setRidePosts((postsData as { posts: RidePost[] }).posts);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || "Failed to load ride");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [rideId]);

  const handlePaymentScreenshot = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }
    // Compress via canvas to avoid localStorage quota issues
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement("canvas");
      const MAX_WIDTH = 800;
      let width = img.width;
      let height = img.height;
      if (width > MAX_WIDTH) {
        height = Math.round((height * MAX_WIDTH) / width);
        width = MAX_WIDTH;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.6);
      setRegForm((prev) => ({ ...prev, paymentScreenshot: dataUrl }));
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      alert("Failed to load image. Please try another file.");
    };
    img.src = objectUrl;
  };

  const handleRegister = async () => {
    if (!hiddenFields.includes("indemnity") && !regForm.agreedIndemnity) return;
    if (!hiddenFields.includes("cancellationTerms") && !regForm.agreedCancellationTerms) return;
    if (registering) return;

    // Only validate fields that are visible
    if (!regForm.riderName) { alert("Please fill in your name"); return; }
    if (!hiddenFields.includes("email") && !regForm.email) { alert("Please fill in your email"); return; }
    if (!hiddenFields.includes("phone") && !regForm.phone) { alert("Please fill in your phone number"); return; }
    if (!hiddenFields.includes("foodPreference") && !regForm.foodPreference) { alert("Please select food preference"); return; }
    if (!hiddenFields.includes("ridingType") && !regForm.ridingType) { alert("Please select riding type"); return; }
    if (enableTshirtSize && !regForm.tshirtSize) { alert("Please select a T-Shirt size"); return; }

    // Payment validation based on mode
    if (!hiddenFields.includes("paymentSection")) {
      if (paymentMode === "screenshot" && !regForm.paymentScreenshot) { alert("Please upload payment screenshot"); return; }
      if (paymentMode === "transaction_id" && !regForm.upiTransactionId) { alert("Please enter UPI transaction ID"); return; }
      if (paymentMode === "both" && !regForm.paymentScreenshot && !regForm.upiTransactionId) { alert("Please provide payment screenshot or transaction ID"); return; }
    }

    setRegistering(true);
    try {
      const data = (await api.rides.register(rideId, {
        ...regForm,
      })) as { registration: unknown; confirmationCode: string };
      setRegistered(true);
      setConfirmationCode(data.confirmationCode);
      setShowRegistration(false);
      // Save form data for future pre-fill (exclude sensitive/one-time fields)
      if (user) {
        try {
          localStorage.setItem(`t2w_reg_prefill_${user.id}`, JSON.stringify({
            riderName: regForm.riderName, address: regForm.address,
            email: regForm.email, phone: regForm.phone,
            emergencyContactName: regForm.emergencyContactName,
            emergencyContactPhone: regForm.emergencyContactPhone,
            bloodGroup: regForm.bloodGroup, referredBy: regForm.referredBy,
            vehicleModel: regForm.vehicleModel, vehicleRegNumber: regForm.vehicleRegNumber,
          }));
        } catch { /* ignore quota errors */ }
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Registration failed";
      alert(message);
    } finally {
      setRegistering(false);
    }
  };

  const handlePostTale = async () => {
    if (!taleText.trim() || !user) return;
    setPostingTale(true);
    try {
      // SuperAdmin/CoreMember: auto-approved. T2W Rider: pending
      const autoApprove = canApproveContent;
      await api.ridePosts.create({
        rideId,
        authorId: user.id,
        authorName: user.name,
        content: taleText,
        approvalStatus: autoApprove ? "approved" : "pending",
        approvedBy: autoApprove ? user.id : undefined,
      });
      setTaleText("");
      setTaleSubmitted(true);
      if (autoApprove) {
        // Reload posts
        const postsData = await api.ridePosts.listApproved(rideId);
        setRidePosts((postsData as { posts: RidePost[] }).posts);
      }
    } catch {
      alert("Failed to post. Please try again.");
    } finally {
      setPostingTale(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center pt-24">
        <div className="text-center">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-t2w-accent" />
          <p className="mt-4 text-t2w-muted">Loading ride details...</p>
        </div>
      </div>
    );
  }

  if (error || !ride) {
    return (
      <div className="flex min-h-screen items-center justify-center pt-24">
        <div className="text-center">
          <Bike className="mx-auto h-16 w-16 text-t2w-border" />
          <h2 className="mt-4 font-display text-2xl font-bold text-white">
            Ride Not Found
          </h2>
          <Link href="/rides" className="mt-4 inline-block text-t2w-accent">
            &larr; Back to Rides
          </Link>
        </div>
      </div>
    );
  }

  const spotsLeft = ride.maxRiders - (ride.activeRegistrations ?? ride.registeredRiders);
  const difficultyColors: Record<string, string> = {
    easy: "text-green-400 bg-green-400/10",
    moderate: "text-yellow-400 bg-yellow-400/10",
    challenging: "text-orange-400 bg-orange-400/10",
    extreme: "text-red-400 bg-red-400/10",
  };

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <Link
          href="/rides"
          className="mb-8 inline-flex items-center gap-2 text-sm text-t2w-muted transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Rides
        </Link>

        {/* Header */}
        <div className="mb-10">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`rounded-lg px-3 py-1 text-sm font-medium capitalize ${
                ride.status === "upcoming"
                  ? "bg-blue-400/10 text-blue-400"
                  : ride.status === "ongoing"
                  ? "bg-yellow-400/10 text-yellow-400"
                  : ride.status === "cancelled"
                  ? "bg-red-400/10 text-red-400"
                  : "bg-green-400/10 text-green-400"
              }`}
            >
              {ride.status === "ongoing" ? "Ongoing Ride" : ride.status}
            </span>
            <span
              className={`rounded-lg px-3 py-1 text-sm font-medium ${difficultyColors[ride.difficulty]}`}
            >
              {ride.difficulty}
            </span>
            <span className="font-mono text-sm text-t2w-muted">
              {ride.rideNumber}
            </span>
          </div>

          <h1 className="mt-4 font-display text-4xl font-bold text-white md:text-5xl">
            {ride.title}
          </h1>
          <p className="mt-4 text-lg text-t2w-muted">{ride.description}</p>

          {/* Live Tracking Button */}
          {(ride.status === "ongoing" || ride.status === "completed") && (
            <Link
              href={`/ride/${ride.id}/live`}
              className={`mt-4 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                ride.status === "ongoing"
                  ? "bg-green-600 hover:bg-green-700 text-white animate-pulse"
                  : "bg-gray-600 hover:bg-gray-700 text-white"
              }`}
            >
              <MapPin className="h-4 w-4" />
              {ride.status === "ongoing" ? "Live Tracking" : "View Ride Map"}
            </Link>
          )}
        </div>

        {/* Ride Poster */}
        {(ride.posterUrl || posterUrl) ? (
          <div className="mb-8 overflow-hidden rounded-2xl border border-t2w-border relative group">
            <img
              src={posterUrl || ride.posterUrl}
              alt={`${ride.title} poster`}
              className="w-full object-cover"
            />
            {canEditRide && (
              <>
                <button
                  onClick={() => posterInputRef.current?.click()}
                  disabled={posterUploading}
                  className="absolute bottom-3 right-3 flex items-center gap-2 rounded-xl bg-black/70 px-3 py-2 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  {posterUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ImagePlus className="h-4 w-4" />
                  )}
                  {posterUploading ? "Saving..." : "Change Poster"}
                </button>
                <input
                  ref={posterInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePosterUpload}
                  className="hidden"
                />
              </>
            )}
          </div>
        ) : canEditRide ? (
          <div className="mb-8">
            <button
              onClick={() => posterInputRef.current?.click()}
              disabled={posterUploading}
              className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-t2w-border bg-t2w-surface/50 py-10 text-t2w-muted transition-colors hover:border-t2w-accent/50 hover:text-t2w-accent"
            >
              {posterUploading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <ImagePlus className="h-6 w-6" />
              )}
              <span className="text-sm font-medium">
                {posterUploading ? "Compressing & Saving..." : "Upload Ride Poster"}
              </span>
            </button>
            <input
              ref={posterInputRef}
              type="file"
              accept="image/*"
              onChange={handlePosterUpload}
              className="hidden"
            />
          </div>
        ) : null}

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Ride Info Cards */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                {
                  icon: Gauge,
                  label: "Distance",
                  value: `${ride.distanceKm} km`,
                },
                {
                  icon: Calendar,
                  label: "Date",
                  value: new Date(ride.startDate).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                  }),
                },
                {
                  icon: Users,
                  label: "Riders",
                  value: `${ride.registeredRiders}/${ride.maxRiders}`,
                },
                {
                  icon: IndianRupee,
                  label: "Fee",
                  value: `₹${ride.fee.toLocaleString()}`,
                },
              ].map(({ icon: Icon, label, value }) => (
                <div
                  key={label}
                  className="rounded-xl border border-t2w-border bg-t2w-surface p-4 text-center"
                >
                  <Icon className="mx-auto h-5 w-5 text-t2w-accent" />
                  <div className="mt-2 font-display text-lg font-bold text-white">
                    {value}
                  </div>
                  <div className="text-xs text-t2w-muted">{label}</div>
                </div>
              ))}
            </div>

            {/* Route */}
            <div className="card">
              <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-white">
                <Route className="h-5 w-5 text-t2w-accent" />
                Route
              </h3>
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                {ride.route.map((stop, i) => (
                  <div key={stop} className="flex items-center gap-2">
                    <div className="flex items-center gap-2 rounded-lg bg-t2w-surface-light px-3 py-2 text-sm text-white whitespace-nowrap">
                      <MapPin className="h-3.5 w-3.5 text-t2w-accent" />
                      {stop}
                    </div>
                    {i < ride.route.length - 1 && (
                      <span className="text-t2w-muted">&rarr;</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Highlights */}
            {ride.highlights.length > 0 && (
              <div className="card">
                <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-white">
                  <Star className="h-5 w-5 text-t2w-gold" />
                  Ride Highlights
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {ride.highlights.map((highlight) => (
                    <div
                      key={highlight}
                      className="flex items-center gap-3 rounded-xl bg-t2w-surface-light p-3"
                    >
                      <CheckCircle className="h-4 w-4 shrink-0 text-t2w-accent" />
                      <span className="text-sm text-gray-300">{highlight}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ride Leaders */}
            <div className="card">
              <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-white">
                <Shield className="h-5 w-5 text-t2w-accent" />
                Ride Crew
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { label: "Lead Rider", name: ride.leadRider, iconColor: "bg-t2w-accent/10", textColor: "text-t2w-accent" },
                  { label: "Sweep Rider", name: ride.sweepRider, iconColor: "bg-t2w-gold/10", textColor: "text-t2w-gold" },
                  ...(ride.organisedBy && ride.organisedBy !== ride.leadRider && ride.organisedBy !== ride.sweepRider
                    ? [{ label: "Organised By", name: ride.organisedBy, iconColor: "bg-purple-400/10", textColor: "text-purple-400" }]
                    : []),
                  ...(ride.accountsBy && ride.accountsBy !== ride.leadRider && ride.accountsBy !== ride.sweepRider && ride.accountsBy !== ride.organisedBy
                    ? [{ label: "Accounts", name: ride.accountsBy, iconColor: "bg-green-400/10", textColor: "text-green-400" }]
                    : []),
                ].filter(c => c.name).map((crew) => {
                  const link = getRiderLink(crew.name, riderNameToId);
                  const crewRiderId = getRiderId(crew.name, riderNameToId);
                  const crewAvatar = crewRiderId ? riderIdToAvatar[crewRiderId] : null;
                  const crewInitials = crew.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
                  const inner = (
                    <>
                      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl overflow-hidden ${crew.iconColor}`}>
                        {crewAvatar ? (
                          <img src={crewAvatar} alt={crew.name} className="h-full w-full object-cover" />
                        ) : (
                          <span className={`font-display text-sm font-bold ${crew.textColor}`}>{crewInitials}</span>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-t2w-muted">{crew.label}</p>
                        <p className={`font-semibold ${link ? "text-t2w-accent" : "text-white"} flex items-center gap-1.5`}>
                          {crew.name}
                          <RoleTag role={getRoleByNameOrId(crew.name, crewRiderId, riderIdToRole, riderNameToRole)} />
                        </p>
                      </div>
                    </>
                  );
                  return link ? (
                    <Link key={crew.label} href={link} className="flex items-center gap-4 rounded-xl bg-t2w-surface-light p-4 transition-all hover:bg-t2w-accent/10 hover:ring-1 hover:ring-t2w-accent/30">
                      {inner}
                    </Link>
                  ) : (
                    <div key={crew.label} className="flex items-center gap-4 rounded-xl bg-t2w-surface-light p-4">
                      {inner}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Confirmed Riders - for upcoming rides */}
            {ride.status === "upcoming" && ride.confirmedRiderNames && ride.confirmedRiderNames.length > 0 && (
              <div className="card">
                <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-white">
                  <Users className="h-5 w-5 text-green-400" />
                  Confirmed Riders ({ride.confirmedRiderNames.length})
                </h3>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {ride.confirmedRiderNames.map((name, index) => {
                    const riderId = getRiderId(name, riderNameToId);
                    const avatar = riderId ? riderIdToAvatar[riderId] : null;
                    const link = riderId ? `/rider/${riderId}` : null;
                    const initials = name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
                    const thumbEl = avatar ? (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full overflow-hidden bg-green-400/10">
                        <img src={avatar} alt={name} className="h-full w-full object-cover" />
                      </div>
                    ) : (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold bg-green-400/10 text-green-400">
                        {initials}
                      </div>
                    );
                    return link ? (
                      <div key={`${name}-${index}`} className="flex items-center gap-3 rounded-lg bg-t2w-surface-light p-2.5 hover:bg-green-400/10 hover:ring-1 hover:ring-green-400/30 transition-all">
                        <Link href={link} className="flex items-center gap-3 flex-1 min-w-0">
                          {thumbEl}
                          <span className="text-sm truncate flex items-center gap-1.5 text-green-400 hover:underline">
                            {name}
                            <RoleTag role={getRoleByNameOrId(name, riderId, riderIdToRole, riderNameToRole)} />
                          </span>
                        </Link>
                      </div>
                    ) : (
                      <div key={`${name}-${index}`} className="flex items-center gap-3 rounded-lg bg-t2w-surface-light p-2.5">
                        {thumbEl}
                        <span className="text-sm truncate flex items-center gap-1.5 text-white">
                          {name}
                          <RoleTag role={getRoleByNameOrId(name, riderId, riderIdToRole, riderNameToRole)} />
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Riders List - for completed rides with rider data */}
            {ride.status === "completed" && ((ride.riders && ride.riders.length > 0) || (ride.confirmedRiderNames && ride.confirmedRiderNames.length > 0)) && (() => {
              const confirmedNames = ride.confirmedRiderNames ?? [];
              const staticRiders = ride.riders ?? [];
              const ridersList = confirmedNames.length > 0 ? confirmedNames : staticRiders;
              return (
              <div className="card">
                <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-white">
                  <Users className="h-5 w-5 text-t2w-accent" />
                  Riders ({ridersList.length})
                </h3>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {ridersList.map((riderName, index) => {
                    const riderId = getRiderId(riderName, riderNameToId);
                    const avatar = riderId ? riderIdToAvatar[riderId] : null;
                    const initials = riderName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
                    const link = riderId ? `/rider/${riderId}` : null;
                    const thumbEl = avatar ? (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full overflow-hidden bg-t2w-accent/10">
                        <img src={avatar} alt={riderName} className="h-full w-full object-cover" />
                      </div>
                    ) : (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold bg-t2w-accent/10 text-t2w-accent">
                        {initials}
                      </div>
                    );
                    return link ? (
                      <div
                        key={`${riderName}-${index}`}
                        className="flex items-center gap-3 rounded-xl p-3 transition-all bg-t2w-surface-light hover:bg-t2w-accent/10 hover:ring-1 hover:ring-t2w-accent/30"
                      >
                        <Link href={link} className="flex items-center gap-3 flex-1 min-w-0">
                          {thumbEl}
                          <span className="text-sm truncate flex items-center gap-1.5 text-t2w-accent hover:underline">
                            {riderName}
                            <RoleTag role={getRoleByNameOrId(riderName, riderId, riderIdToRole, riderNameToRole)} />
                          </span>
                        </Link>
                      </div>
                    ) : (
                      <div
                        key={`${riderName}-${index}`}
                        className="flex items-center gap-3 rounded-xl p-3 bg-t2w-surface-light"
                      >
                        {thumbEl}
                        <span className="text-sm truncate flex items-center gap-1.5 flex-1 min-w-0 text-gray-300">
                          {riderName}
                          <RoleTag role={getRoleByNameOrId(riderName, riderId, riderIdToRole, riderNameToRole)} />
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
              );
            })()}

            {/* Approved Ride Posts / Tales */}
            {ridePosts.length > 0 && (
              <div className="card">
                <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-white">
                  <FileText className="h-5 w-5 text-t2w-accent" />
                  Rider Tales ({ridePosts.length})
                </h3>
                <div className="space-y-4">
                  {ridePosts.map((post) => (
                    <div
                      key={post.id}
                      className="rounded-xl bg-t2w-surface-light p-4"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-t2w-accent/10 text-xs font-bold text-t2w-accent">
                          {post.authorName
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .slice(0, 2)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">
                            {post.authorName}
                          </p>
                          <p className="text-xs text-t2w-muted">
                            {new Date(post.createdAt).toLocaleDateString(
                              "en-IN",
                              {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              }
                            )}
                          </p>
                        </div>
                      </div>
                      <p className="text-sm text-gray-300 whitespace-pre-line">
                        {post.content}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Share Experience - for completed rides, T2W riders+ */}
            {ride.status === "completed" && isLoggedIn && (
              <div className="card">
                <h3 className="mb-4 font-display text-lg font-bold text-white">
                  Share Your Experience
                </h3>
                {!isT2WRiderOrAbove ? (
                  <p className="text-sm text-t2w-muted">
                    Only T2W riders who have participated in rides can share
                    tales.
                  </p>
                ) : taleSubmitted && !canApproveContent ? (
                  <div className="rounded-xl bg-green-400/10 border border-green-400/20 p-4 text-center">
                    <CheckCircle className="mx-auto h-8 w-8 text-green-400" />
                    <p className="mt-2 text-sm font-medium text-green-400">
                      Your tale has been submitted!
                    </p>
                    <p className="mt-1 text-xs text-t2w-muted">
                      It will be visible once approved by a Core Member or Super
                      Admin.
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="mb-4 text-sm text-t2w-muted">
                      Were you part of this ride? Share your personal experience
                      with the T2W community.
                      {!canApproveContent && (
                        <span className="text-yellow-400">
                          {" "}
                          (Subject to approval)
                        </span>
                      )}
                    </p>
                    <textarea
                      rows={4}
                      className="input-field mb-4 resize-none"
                      placeholder="Write about your ride experience..."
                      value={taleText}
                      onChange={(e) => setTaleText(e.target.value)}
                    />
                    <button
                      onClick={handlePostTale}
                      disabled={!taleText.trim() || postingTale}
                      className="btn-primary flex items-center gap-2"
                    >
                      {postingTale ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      {postingTale ? "Posting..." : "Post Your Tale"}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Registration Card - for upcoming rides */}
            {ride.status === "upcoming" && !registered && (
              <div className="card sticky top-28">
                <h3 className="mb-4 font-display text-lg font-bold text-white">
                  Register for this Ride
                </h3>

                {(() => {
                  const regStatus = getRegistrationStatus(ride, user?.role);
                  if (!user) {
                    // For guests, check if the rider/guest window is even open
                    const guestStatus = getRegistrationStatus(ride, undefined);
                    if (!guestStatus.open && guestStatus.opensAt) {
                      return (
                        <div className="rounded-xl bg-yellow-400/10 p-4 text-center">
                          <p className="text-sm font-medium text-yellow-400 mb-1">Registration opens soon</p>
                          <p className="text-xs text-t2w-muted">Opens on {guestStatus.opensAt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} at {guestStatus.opensAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</p>
                          <Link href="/login" className="btn-primary inline-block mt-3 text-sm">Log In to Register</Link>
                        </div>
                      );
                    }
                    return (
                      <div className="rounded-xl bg-t2w-surface-light p-4 text-center">
                        <p className="text-sm text-t2w-muted mb-3">You must be logged in to register for a ride.</p>
                        <Link href="/login" className="btn-primary inline-block">Log In to Register</Link>
                      </div>
                    );
                  }
                  if (!regStatus.open && regStatus.opensAt) {
                    return (
                      <div className="rounded-xl bg-yellow-400/10 p-4 text-center">
                        <p className="text-sm font-medium text-yellow-400 mb-1">Registration not yet open</p>
                        <p className="text-xs text-t2w-muted">Opens for you on {regStatus.opensAt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} at {regStatus.opensAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</p>
                      </div>
                    );
                  }
                  if (spotsLeft > 0) {
                    return (
                      <>
                        <div className="mb-4 rounded-xl bg-t2w-accent/10 p-4">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-t2w-muted">Registration Fee</span>
                            <span className="font-display text-2xl font-bold text-t2w-accent">₹{ride.fee.toLocaleString()}</span>
                          </div>
                          <p className="mt-1 text-xs text-t2w-muted">{spotsLeft} spots remaining</p>
                        </div>
                        <button onClick={() => setShowRegistration(true)} className="btn-primary w-full">Register Now</button>
                      </>
                    );
                  }
                  return (
                    <div className="rounded-xl bg-red-400/10 p-4 text-center">
                      <p className="text-sm font-medium text-red-400">This ride is fully booked</p>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Registration Modal - Single Scrollable Form */}
            {showRegistration && user && (
              <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm p-4 pt-10 pb-10">
                <div className="relative w-full max-w-2xl rounded-2xl border border-t2w-border bg-t2w-surface">
                  {/* Modal Header */}
                  <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-2xl border-b border-t2w-border bg-t2w-surface px-6 py-4">
                    <div>
                      <h2 className="font-display text-lg font-bold text-white">Ride Registration</h2>
                      <p className="text-xs text-t2w-muted">{ride.title}</p>
                    </div>
                    <button onClick={() => setShowRegistration(false)} className="rounded-lg p-2 text-t2w-muted transition-colors hover:bg-white/10 hover:text-white">
                      <XCircle className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="space-y-6 p-6">
                    {/* ── Section 1: Personal Details ── */}
                    <div>
                      <h3 className="mb-4 flex items-center gap-2 font-display text-base font-bold text-white">
                        <User className="h-5 w-5 text-t2w-accent" />
                        Personal Details
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-gray-300">Rider Name <span className="text-red-400">*</span></label>
                          <div className="relative">
                            <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-t2w-muted" />
                            <input type="text" required className="input-field !pl-10" placeholder="Your full name" value={regForm.riderName} onChange={(e) => setRegForm({ ...regForm, riderName: e.target.value })} />
                          </div>
                        </div>

                        {!hiddenFields.includes("address") && (
                          <div>
                            <label className="mb-1.5 block text-sm font-medium text-gray-300">Address <span className="text-red-400">*</span></label>
                            <textarea required rows={2} className="input-field text-sm" placeholder="Enter your COMPLETE address" value={regForm.address} onChange={(e) => setRegForm({ ...regForm, address: e.target.value })} />
                          </div>
                        )}

                        {(!hiddenFields.includes("email") || !hiddenFields.includes("phone")) && (
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            {!hiddenFields.includes("email") && (
                              <div>
                                <label className="mb-1.5 block text-sm font-medium text-gray-300">Email <span className="text-red-400">*</span></label>
                                <div className="relative">
                                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-t2w-muted" />
                                  <input type="email" required className="input-field !pl-10" placeholder="rider@example.com" value={regForm.email} onChange={(e) => setRegForm({ ...regForm, email: e.target.value })} />
                                </div>
                              </div>
                            )}
                            {!hiddenFields.includes("phone") && (
                              <div>
                                <label className="mb-1.5 block text-sm font-medium text-gray-300">Phone / WhatsApp <span className="text-red-400">*</span></label>
                                <div className="relative">
                                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-t2w-muted" />
                                  <input type="tel" required className="input-field !pl-10" placeholder="Your mobile number" value={regForm.phone} onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })} />
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {!hiddenFields.includes("emergencyContact") && (
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                              <label className="mb-1.5 block text-sm font-medium text-gray-300">Emergency Contact (Name & Relation) <span className="text-red-400">*</span></label>
                              <input type="text" required className="input-field" placeholder="e.g. John Doe (Brother)" value={regForm.emergencyContactName} onChange={(e) => setRegForm({ ...regForm, emergencyContactName: e.target.value })} />
                            </div>
                            <div>
                              <label className="mb-1.5 block text-sm font-medium text-gray-300">Emergency Contact No. <span className="text-red-400">*</span></label>
                              <div className="relative">
                                <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-t2w-muted" />
                                <input type="tel" required className="input-field !pl-10" placeholder="Emergency phone number" value={regForm.emergencyContactPhone} onChange={(e) => setRegForm({ ...regForm, emergencyContactPhone: e.target.value })} />
                              </div>
                            </div>
                          </div>
                        )}

                        {(!hiddenFields.includes("bloodGroup") || !hiddenFields.includes("foodPreference") || !hiddenFields.includes("ridingType")) && (
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                            {!hiddenFields.includes("bloodGroup") && (
                              <div>
                                <label className="mb-1.5 block text-sm font-medium text-gray-300">Blood Group <span className="text-red-400">*</span></label>
                                <div className="relative">
                                  <Droplets className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-t2w-muted" />
                                  <select required className="input-field !pl-10 cursor-pointer" value={regForm.bloodGroup} onChange={(e) => setRegForm({ ...regForm, bloodGroup: e.target.value })}>
                                    <option value="">Select</option>
                                    <option value="A+">A+</option><option value="A-">A-</option>
                                    <option value="B+">B+</option><option value="B-">B-</option>
                                    <option value="AB+">AB+</option><option value="AB-">AB-</option>
                                    <option value="O+">O+</option><option value="O-">O-</option>
                                  </select>
                                </div>
                              </div>
                            )}
                            {!hiddenFields.includes("foodPreference") && (
                              <div>
                                <label className="mb-1.5 block text-sm font-medium text-gray-300">Food Preference <span className="text-red-400">*</span></label>
                                <select required className="input-field cursor-pointer" value={regForm.foodPreference} onChange={(e) => setRegForm({ ...regForm, foodPreference: e.target.value as "vegetarian" | "non-vegetarian" })}>
                                  <option value="">Select</option>
                                  <option value="vegetarian">Vegetarian</option>
                                  <option value="non-vegetarian">Non-Vegetarian</option>
                                </select>
                              </div>
                            )}
                            {!hiddenFields.includes("ridingType") && (
                              <div>
                                <label className="mb-1.5 block text-sm font-medium text-gray-300">Riding Type <span className="text-red-400">*</span></label>
                                <select required className="input-field cursor-pointer" value={regForm.ridingType} onChange={(e) => setRegForm({ ...regForm, ridingType: e.target.value as "solo" | "rider-with-pillion" | "pillion-rider" })}>
                                  <option value="">Select</option>
                                  <option value="solo">Solo Rider</option>
                                  <option value="rider-with-pillion">Rider with Pillion</option>
                                  <option value="pillion-rider">Pillion Rider</option>
                                </select>
                              </div>
                            )}
                          </div>
                        )}

                        {!hiddenFields.includes("referredBy") && (
                          <div>
                            <label className="mb-1.5 block text-sm font-medium text-gray-300">Referred By</label>
                            <input type="text" className="input-field" placeholder="If riding for the first time with us" value={regForm.referredBy} onChange={(e) => setRegForm({ ...regForm, referredBy: e.target.value })} />
                          </div>
                        )}

                        {!hiddenFields.includes("vehicle") && (
                          <div className="space-y-3">
                            {userMotorcycles.length > 0 && (
                              <div>
                                <label className="mb-1.5 block text-sm font-medium text-gray-300">Select from My Motorcycles</label>
                                <select
                                  className="input-field cursor-pointer"
                                  value=""
                                  onChange={(e) => {
                                    const moto = userMotorcycles.find((m) => m.id === e.target.value);
                                    if (moto) {
                                      setRegForm((prev) => ({
                                        ...prev,
                                        vehicleModel: `${moto.make} ${moto.model} ${moto.cc}cc`,
                                        vehicleRegNumber: prev.vehicleRegNumber,
                                      }));
                                    }
                                  }}
                                >
                                  <option value="">-- Pick a motorcycle --</option>
                                  {userMotorcycles.map((m) => (
                                    <option key={m.id} value={m.id}>
                                      {m.make} {m.model} {m.cc}cc {m.nickname ? `(${m.nickname})` : ""}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                              <div>
                                <label className="mb-1.5 block text-sm font-medium text-gray-300">Vehicle Model</label>
                                <div className="relative">
                                  <Bike className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-t2w-muted" />
                                  <input type="text" className="input-field !pl-10" placeholder="e.g. Royal Enfield Himalayan 450" value={regForm.vehicleModel} onChange={(e) => setRegForm({ ...regForm, vehicleModel: e.target.value })} />
                                </div>
                              </div>
                              <div>
                                <label className="mb-1.5 block text-sm font-medium text-gray-300">Vehicle Reg. Number</label>
                                <div className="relative">
                                  <Car className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-t2w-muted" />
                                  <input type="text" className="input-field !pl-10" placeholder="e.g. KA 01 AB 1234" value={regForm.vehicleRegNumber} onChange={(e) => setRegForm({ ...regForm, vehicleRegNumber: e.target.value })} />
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {enableTshirtSize && (
                          <div>
                            <label className="mb-1.5 block text-sm font-medium text-gray-300">T-Shirt Size <span className="text-red-400">*</span></label>
                            <select required className="input-field cursor-pointer" value={regForm.tshirtSize} onChange={(e) => setRegForm({ ...regForm, tshirtSize: e.target.value as "XS" | "S" | "M" | "L" | "XL" | "XXL" | "XXXL" })}>
                              <option value="">Select T-Shirt Size</option>
                              <option value="XS">Extra Small (XS)</option>
                              <option value="S">Small (S)</option>
                              <option value="M">Medium (M)</option>
                              <option value="L">Large (L)</option>
                              <option value="XL">Extra Large (XL)</option>
                              <option value="XXL">Extra Extra Large (XXL)</option>
                              <option value="XXXL">Extra Extra Extra Large (XXXL)</option>
                            </select>
                          </div>
                        )}
                      </div>
                    </div>

                    {!hiddenFields.includes("cancellationTerms") && (
                      <>
                        <hr className="border-t2w-border" />

                        {/* ── Section 2: Cancellation & Refund ── */}
                        <div>
                          <h3 className="mb-3 flex items-center gap-2 font-display text-base font-bold text-white">
                            <FileText className="h-5 w-5 text-t2w-accent" />
                            Cancellation and Refund Terms
                          </h3>
                          <div className="rounded-xl border border-t2w-border bg-t2w-bg p-4">
                            <div className="whitespace-pre-line text-sm text-t2w-muted leading-relaxed">
                              {cancellationText.split("\n").map((line, i) => {
                                if (line.startsWith("__") && line.endsWith("__")) return <p key={i} className="mt-2 font-semibold text-t2w-accent">{line.replace(/__/g, "")}</p>;
                                if (/^\d+\./.test(line)) return <p key={i} className="ml-3 mt-1 text-gray-300"><span className="text-t2w-accent font-medium">{line.split(":")[0]}:</span>{line.includes(":") ? line.slice(line.indexOf(":") + 1) : ""}</p>;
                                return <p key={i} className={i > 0 ? "mt-1" : ""}>{line}</p>;
                              })}
                            </div>
                          </div>
                          <label className="mt-3 flex items-center gap-3 cursor-pointer rounded-xl border border-t2w-border bg-t2w-surface-light p-4">
                            <input type="checkbox" checked={regForm.agreedCancellationTerms} onChange={(e) => setRegForm({ ...regForm, agreedCancellationTerms: e.target.checked })} className="h-5 w-5 shrink-0 rounded border-t2w-border accent-t2w-accent" />
                            <span className="text-sm text-gray-300">I agree to the Cancellation and Refund Terms <span className="text-red-400">*</span></span>
                          </label>
                        </div>
                      </>
                    )}

                    {!hiddenFields.includes("paymentSection") && (
                      <>
                        <hr className="border-t2w-border" />

                        {/* ── Section 3: Payment ── */}
                        <div>
                          <h3 className="mb-3 flex items-center gap-2 font-display text-base font-bold text-white">
                            <IndianRupee className="h-5 w-5 text-t2w-accent" />
                            Payment Details
                          </h3>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between rounded-xl bg-t2w-accent/10 p-4">
                              <span className="text-sm text-t2w-muted">Registration Fee</span>
                              <span className="font-display text-2xl font-bold text-t2w-accent">₹{ride.fee.toLocaleString()}</span>
                            </div>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                              {effectiveUpiIds.filter(u => u.id).map((upi, idx) => (
                                <div key={idx} className="rounded-lg bg-t2w-surface-light p-3">
                                  <p className="mb-1 text-sm font-medium text-gray-300">{upi.label ? `Pay via UPI (${upi.label})` : "Pay via UPI"}</p>
                                  <p className="font-mono text-t2w-accent">{upi.id}</p>
                                </div>
                              ))}
                              {effectiveBankAccounts.filter(b => b.details).map((bank, idx) => (
                                <div key={idx} className="rounded-lg bg-t2w-surface-light p-3">
                                  <p className="mb-1 text-sm font-medium text-gray-300">{bank.label ? `Bank Transfer (${bank.label})` : "Bank Transfer"}</p>
                                  <p className="whitespace-pre-line text-xs text-t2w-muted">{bank.details}</p>
                                </div>
                              ))}
                            </div>

                            {/* Screenshot upload */}
                            {(paymentMode === "screenshot" || paymentMode === "both") && (
                              <div>
                                <label className="mb-1.5 block text-sm font-medium text-gray-300">Attach Payment Screenshot{paymentMode === "screenshot" && <span className="text-red-400"> *</span>}</label>
                                <input ref={paymentInputRef} type="file" accept="image/*" onChange={handlePaymentScreenshot} className="hidden" />
                                <button onClick={() => paymentInputRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-t2w-border bg-t2w-bg px-4 py-4 text-sm text-t2w-muted transition-colors hover:border-t2w-accent/50 hover:text-gray-300">
                                  <ImagePlus className="h-5 w-5" />
                                  {regForm.paymentScreenshot ? "Screenshot attached - click to change" : "Click to upload payment screenshot"}
                                </button>
                                {regForm.paymentScreenshot && (
                                  <div className="mt-2 flex items-center justify-center gap-2 rounded-lg border border-green-400/30 bg-green-400/5 p-2">
                                    <CheckCircle className="h-4 w-4 text-green-400" />
                                    <p className="text-xs text-green-400">Payment screenshot attached</p>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Transaction ID text input */}
                            {(paymentMode === "transaction_id" || paymentMode === "both") && (
                              <div>
                                <label className="mb-1.5 block text-sm font-medium text-gray-300">UPI Transaction ID / Reference Number{paymentMode === "transaction_id" && <span className="text-red-400"> *</span>}</label>
                                <input
                                  type="text"
                                  className="input-field"
                                  placeholder="e.g. 412345678901"
                                  value={regForm.upiTransactionId}
                                  onChange={(e) => setRegForm({ ...regForm, upiTransactionId: e.target.value })}
                                />
                              </div>
                            )}

                            {paymentMode === "both" && (
                              <p className="text-xs text-t2w-muted">Please provide at least one: payment screenshot or transaction ID</p>
                            )}
                          </div>
                        </div>
                      </>
                    )}

                    {!hiddenFields.includes("indemnity") && (
                      <>
                        <hr className="border-t2w-border" />

                        {/* ── Section 4: Acknowledgement & Indemnity ── */}
                        <div>
                          <h3 className="mb-3 flex items-center gap-2 font-display text-base font-bold text-yellow-400">
                            <AlertTriangle className="h-5 w-5" />
                            Acknowledgement & Indemnity
                          </h3>

                          <div className="space-y-3">
                            <details className="group rounded-xl border border-yellow-400/20 bg-yellow-400/5">
                              <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-yellow-400 flex items-center justify-between">
                                Acknowledgement of Risk, Danger and Obligations (16 points)
                                <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                              </summary>
                              <div className="border-t border-yellow-400/10 px-4 py-3">
                                <ol className="ml-4 list-decimal space-y-1.5 text-xs text-t2w-muted leading-relaxed">
                                  <li>I acknowledge that motorcycle riding is inherently dangerous and involves risks of serious injury, permanent disability, or death.</li>
                                  <li>I am aware that participating in group rides increases the complexity and risk of riding.</li>
                                  <li>I confirm that I hold a valid driving license appropriate for the vehicle I will be operating.</li>
                                  <li>I confirm that my vehicle is in roadworthy condition with valid insurance, registration, and pollution certificate.</li>
                                  <li>I will wear proper riding gear including a helmet (ISI/DOT certified), riding jacket, gloves, riding pants, and boots at all times during the ride.</li>
                                  <li>I will follow all traffic rules and regulations as per the Motor Vehicles Act of India.</li>
                                  <li>I will adhere to the riding formation, speed limits, and guidelines set by T2W ride captains.</li>
                                  <li>I understand that alcohol, drugs, or any intoxicating substances are strictly prohibited before and during the ride.</li>
                                  <li>I will not engage in stunting, racing, or reckless riding during the event.</li>
                                  <li>I acknowledge that T2W ride captains have the authority to remove any participant who endangers themselves or others.</li>
                                  <li>I understand that weather, road, or other conditions may cause route changes or ride cancellations at T2W&apos;s discretion.</li>
                                  <li>I am medically fit to participate in this ride and have disclosed any medical conditions to the organizers.</li>
                                  <li>I will carry my own basic first aid kit and any prescribed medications.</li>
                                  <li>I understand that mobile phone use while riding is prohibited.</li>
                                  <li>I will maintain adequate fuel levels and plan fuel stops as communicated by ride captains.</li>
                                  <li>I accept full responsibility for my pillion rider (if applicable) and ensure they also wear proper safety gear.</li>
                                </ol>
                              </div>
                            </details>

                            <details className="group rounded-xl border border-red-400/20 bg-red-400/5">
                              <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-red-400 flex items-center justify-between">
                                Indemnity Given to Organisers (12 points)
                                <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                              </summary>
                              <div className="border-t border-red-400/10 px-4 py-3">
                                <ol className="ml-4 list-decimal space-y-1.5 text-xs text-t2w-muted leading-relaxed">
                                  <li>I voluntarily assume all risks associated with participating in this motorcycle ride organized by Tales on 2 Wheels (T2W).</li>
                                  <li>I hereby release, discharge, and hold harmless T2W, its organizers, ride captains, volunteers, sponsors, and affiliates from any and all liability, claims, demands, and causes of action.</li>
                                  <li>This release applies to any injury, illness, death, or property damage that may occur during the ride, including during transit to and from the ride location.</li>
                                  <li>I understand that T2W does not provide insurance coverage for participants and that I am responsible for my own health, life, and vehicle insurance.</li>
                                  <li>I agree not to hold T2W responsible for any mechanical failure, accident, theft, or loss of personal belongings during the ride.</li>
                                  <li>I consent to receiving emergency medical treatment if necessary and agree to bear all associated costs.</li>
                                  <li>I grant T2W permission to use photographs, videos, and other media captured during the ride for promotional purposes without compensation.</li>
                                  <li>I confirm that I am participating in this ride of my own free will and have not been coerced.</li>
                                  <li>I understand that this indemnity agreement is binding and applies to all rides I participate in under T2W until revoked in writing.</li>
                                  <li>I agree to indemnify and hold harmless T2W against any third-party claims arising from my actions during the ride.</li>
                                  <li>I acknowledge that I have read, understood, and agree to all the terms mentioned in this document.</li>
                                  <li>I understand that providing false information in this registration form may result in disqualification from the ride without refund.</li>
                                </ol>
                              </div>
                            </details>
                          </div>

                          <label className="mt-3 flex items-center gap-3 cursor-pointer rounded-xl border border-yellow-400/20 bg-yellow-400/5 p-4">
                            <input type="checkbox" checked={regForm.agreedIndemnity} onChange={(e) => setRegForm({ ...regForm, agreedIndemnity: e.target.checked })} className="h-5 w-5 shrink-0 rounded border-t2w-border accent-t2w-accent" />
                            <span className="text-sm text-gray-300">I have read and agree to all the Acknowledgement and Indemnity terms above <span className="text-red-400">*</span></span>
                          </label>
                        </div>
                      </>
                    )}

                    <hr className="border-t2w-border" />

                    {/* Submit */}
                    <button
                      disabled={
                        (!hiddenFields.includes("indemnity") && !regForm.agreedIndemnity) ||
                        (!hiddenFields.includes("cancellationTerms") && !regForm.agreedCancellationTerms) ||
                        (!hiddenFields.includes("paymentSection") && paymentMode === "screenshot" && !regForm.paymentScreenshot) ||
                        (!hiddenFields.includes("paymentSection") && paymentMode === "transaction_id" && !regForm.upiTransactionId) ||
                        (!hiddenFields.includes("paymentSection") && paymentMode === "both" && !regForm.paymentScreenshot && !regForm.upiTransactionId) ||
                        registering
                      }
                      onClick={handleRegister}
                      className={`w-full rounded-xl py-3.5 text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                        !(
                          (!hiddenFields.includes("indemnity") && !regForm.agreedIndemnity) ||
                          (!hiddenFields.includes("cancellationTerms") && !regForm.agreedCancellationTerms) ||
                          (!hiddenFields.includes("paymentSection") && paymentMode === "screenshot" && !regForm.paymentScreenshot) ||
                          (!hiddenFields.includes("paymentSection") && paymentMode === "transaction_id" && !regForm.upiTransactionId) ||
                          (!hiddenFields.includes("paymentSection") && paymentMode === "both" && !regForm.paymentScreenshot && !regForm.upiTransactionId) ||
                          registering
                        )
                          ? "btn-primary"
                          : "cursor-not-allowed bg-t2w-surface-light text-t2w-muted"
                      }`}
                    >
                      {registering ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</>
                      ) : (
                        <><CheckCircle className="h-4 w-4" /> Submit Registration</>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Registration Thank You */}
            {registered && (
              <div className="card border-green-400/30 bg-green-400/5">
                <div className="text-center">
                  <CheckCircle className="mx-auto h-12 w-12 text-green-400" />
                  <h3 className="mt-3 font-display text-lg font-bold text-white">
                    Thank You for Registering!
                  </h3>
                  <p className="mt-2 text-sm text-t2w-muted">
                    Your registration for <span className="text-white font-medium">{ride.title}</span> has been submitted successfully.
                    A confirmation email has been sent to your registered email address.
                  </p>
                  <div className="mt-4 rounded-xl bg-t2w-surface p-3 font-mono text-sm text-t2w-accent">
                    Confirmation #{confirmationCode}
                  </div>
                  {approvalStatus !== "confirmed" && (
                    <p className="mt-3 text-xs text-yellow-400">
                      Your registration is pending confirmation by the T2W team. You will appear on the ride page once confirmed.
                    </p>
                  )}
                  {approvalStatus === "confirmed" && (
                    <p className="mt-3 text-xs text-green-400">
                      Your registration has been confirmed!
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Quick Info */}
            <div className="card">
              <h4 className="mb-3 text-sm font-semibold text-t2w-muted uppercase tracking-wider">
                Quick Info
              </h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-t2w-muted">Type</span>
                  <span className="font-medium text-white capitalize">
                    {ride.type.replace("-", " ")}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-t2w-muted">Start</span>
                  {ride.startLocationUrl ? (
                    <a href={ride.startLocationUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-t2w-accent hover:underline">
                      {ride.startLocation} ↗
                    </a>
                  ) : (
                    <span className="font-medium text-white">{ride.startLocation}</span>
                  )}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-t2w-muted">End</span>
                  {ride.endLocationUrl ? (
                    <a href={ride.endLocationUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-t2w-accent hover:underline">
                      {ride.endLocation} ↗
                    </a>
                  ) : (
                    <span className="font-medium text-white">{ride.endLocation}</span>
                  )}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-t2w-muted">Duration</span>
                  <span className="font-medium text-white">
                    {ride.startDate === ride.endDate
                      ? "1 Day"
                      : `${Math.ceil(
                          (new Date(ride.endDate).getTime() -
                            new Date(ride.startDate).getTime()) /
                            (1000 * 60 * 60 * 24)
                        )} Days`}
                  </span>
                </div>
                {ride.organisedBy && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-t2w-muted">Organised By</span>
                    {getRiderLink(ride.organisedBy, riderNameToId) ? (
                      <Link href={getRiderLink(ride.organisedBy, riderNameToId)!} className="font-medium text-t2w-accent hover:underline">
                        {ride.organisedBy}
                      </Link>
                    ) : (
                      <span className="font-medium text-white">{ride.organisedBy}</span>
                    )}
                  </div>
                )}
                {ride.accountsBy && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-t2w-muted">Accounts</span>
                    {getRiderLink(ride.accountsBy, riderNameToId) ? (
                      <Link href={getRiderLink(ride.accountsBy, riderNameToId)!} className="font-medium text-t2w-accent hover:underline">
                        {ride.accountsBy}
                      </Link>
                    ) : (
                      <span className="font-medium text-white">{ride.accountsBy}</span>
                    )}
                  </div>
                )}
                {ride.startingPoint && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-t2w-muted">Starting Point</span>
                    <a
                      href={getGoogleMapsUrl(ride.startingPoint)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-t2w-accent hover:underline flex items-center gap-1"
                    >
                      <MapPin className="h-3 w-3" />
                      {ride.startingPoint}
                    </a>
                  </div>
                )}
                {ride.meetupTime && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-t2w-muted">Meetup Time</span>
                    <span className="font-medium text-white">
                      {ride.meetupTime}
                    </span>
                  </div>
                )}
                {ride.rideStartTime && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-t2w-muted">Ride Starts</span>
                    <span className="font-medium text-white">
                      {ride.rideStartTime}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
