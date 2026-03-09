"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Mail,
  Phone,
  Bike,
  User,
  Shield,
  Camera,
  Heart,
  Award,
  Loader2,
  Gauge,
  Flag,
  ChevronDown,
  Pencil,
  Save,
  X,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";
import type { RiderProfile } from "@/data/rider-profiles";

export function RiderProfilePage({ riderId }: { riderId: string }) {
  const { user, canEditProfile, isSuperAdmin } = useAuth();
  const isOwnProfile = user?.linkedRiderId === riderId;
  // Super admin or own profile can see all personal info (email, phone, address, emergency)
  const canViewAllPersonalInfo = isSuperAdmin || isOwnProfile;
  // Riders sharing a ride can see phone + emergency contact only
  const [sharesRide, setSharesRide] = useState(false);
  const canViewEmergencyAndPhone = canViewAllPersonalInfo || sharesRide;
  const [rider, setRider] = useState<RiderProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    emergencyContact: "",
    emergencyPhone: "",
    bloodGroup: "",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canEdit = canEditProfile(riderId);

  useEffect(() => {
    api.riders
      .get(riderId)
      .then((data: unknown) => {
        const d = data as { rider: RiderProfile };
        setRider(d.rider);
        setEditForm({
          name: d.rider.name,
          email: d.rider.email,
          phone: d.rider.phone,
          address: d.rider.address,
          emergencyContact: d.rider.emergencyContact,
          emergencyPhone: d.rider.emergencyPhone,
          bloodGroup: d.rider.bloodGroup,
        });
        // Check if logged-in user shares a ride with this rider
        if (user?.linkedRiderId && user.linkedRiderId !== riderId) {
          api.riders
            .get(user.linkedRiderId)
            .then((myData: unknown) => {
              const myRider = (myData as { rider: RiderProfile }).rider;
              const viewedRideIds = new Set(
                d.rider.ridesParticipated.map((r) => r.rideId)
              );
              const hasSharedRide = myRider.ridesParticipated.some((r) =>
                viewedRideIds.has(r.rideId)
              );
              setSharesRide(hasSharedRide);
            })
            .catch(() => {});
        }
        // Load avatar from shared store first, then per-key fallback
        const sharedAvatar = api.avatars.get(riderId);
        const legacyAvatar = localStorage.getItem(`t2w_avatar_${riderId}`);
        const avatar = sharedAvatar || legacyAvatar;
        if (avatar) setAvatarUrl(avatar);
        // Grid store is the primary source - data is already loaded from api.riders.get
        // No need for separate localStorage overrides
      })
      .catch((err: unknown) => {
        const e = err as Error;
        setError(e.message || "Failed to load rider");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [riderId, user?.linkedRiderId]);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("Image must be under 5MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setAvatarUrl(dataUrl);
      // Save to both legacy per-key and shared store for visibility
      localStorage.setItem(`t2w_avatar_${riderId}`, dataUrl);
      api.avatars.save(riderId, dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
    if (!rider) return;
    const updates = { ...editForm };
    // Save to grid store (primary database) - persists across all pages
    try {
      await api.riders.update(riderId, updates);
    } catch {
      // Fallback: save to localStorage
      localStorage.setItem(`t2w_profile_${riderId}`, JSON.stringify(updates));
    }
    // Also update user record for account data sync
    try {
      await api.users.update(riderId, {
        name: updates.name,
        email: updates.email,
        phone: updates.phone,
      });
    } catch {
      // User record may not exist yet for static rider profiles
    }
    setRider({ ...rider, ...updates });
    setEditing(false);
  };

  const handleCancelEdit = () => {
    if (!rider) return;
    setEditForm({
      name: rider.name,
      email: rider.email,
      phone: rider.phone,
      address: rider.address,
      emergencyContact: rider.emergencyContact,
      emergencyPhone: rider.emergencyPhone,
      bloodGroup: rider.bloodGroup,
    });
    setEditing(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center pt-24">
        <div className="text-center">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-t2w-accent" />
          <p className="mt-4 text-t2w-muted">Loading rider profile...</p>
        </div>
      </div>
    );
  }

  if (error || !rider) {
    return (
      <div className="flex min-h-screen items-center justify-center pt-24">
        <div className="text-center">
          <User className="mx-auto h-16 w-16 text-t2w-border" />
          <h2 className="mt-4 font-display text-2xl font-bold text-white">
            Rider Not Found
          </h2>
          <p className="mt-2 text-t2w-muted">
            This rider profile could not be found.
          </p>
          <Link href="/rides" className="mt-4 inline-block text-t2w-accent">
            &larr; Back to Rides
          </Link>
        </div>
      </div>
    );
  }

  const initials = rider.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  let badge = {
    name: "New Rider",
    color: "text-gray-400",
    bg: "bg-gray-400/10",
  };
  if (rider.ridesCompleted >= 20) {
    badge = {
      name: "Legend",
      color: "text-yellow-300",
      bg: "bg-yellow-300/10",
    };
  } else if (rider.ridesCompleted >= 15) {
    badge = {
      name: "Ace Rider",
      color: "text-purple-400",
      bg: "bg-purple-400/10",
    };
  } else if (rider.ridesCompleted >= 10) {
    badge = {
      name: "Veteran",
      color: "text-t2w-gold",
      bg: "bg-t2w-gold/10",
    };
  } else if (rider.ridesCompleted >= 5) {
    badge = {
      name: "Regular",
      color: "text-t2w-accent",
      bg: "bg-t2w-accent/10",
    };
  } else if (rider.ridesCompleted >= 2) {
    badge = {
      name: "Explorer",
      color: "text-green-400",
      bg: "bg-green-400/10",
    };
  }

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <Link
          href="/rides"
          className="mb-8 inline-flex items-center gap-2 text-sm text-t2w-muted transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Rides
        </Link>

        {/* Profile Header */}
        <div className="card mb-8">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            {/* Avatar */}
            <div className="relative group">
              <div className="h-28 w-28 shrink-0 overflow-hidden rounded-2xl border-2 border-t2w-border bg-t2w-surface-light">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={rider.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-t2w-accent/20 to-t2w-gold/20">
                    <span className="font-display text-3xl font-bold text-t2w-accent">
                      {initials}
                    </span>
                  </div>
                )}
              </div>
              {canEdit && (
                <>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <Camera className="h-6 w-6 text-white" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                </>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 text-center sm:text-left">
              <div className="flex flex-col items-center gap-3 sm:flex-row">
                <h1 className="font-display text-3xl font-bold text-white">
                  {rider.name}
                </h1>
                <span
                  className={`rounded-lg px-3 py-1 text-xs font-semibold ${badge.color} ${badge.bg}`}
                >
                  <Award className="mr-1 inline h-3 w-3" />
                  {badge.name}
                </span>
              </div>

              {/* Email: super admin or own profile only */}
              {canViewAllPersonalInfo && (
                <div className="mt-3 flex flex-wrap items-center justify-center gap-4 sm:justify-start">
                  {rider.email && (
                    <div className="flex items-center gap-1.5 text-sm text-t2w-muted">
                      <Mail className="h-3.5 w-3.5 text-t2w-accent/70" />
                      <span>{rider.email}</span>
                    </div>
                  )}
                </div>
              )}
              {/* Phone: super admin, own profile, or riders sharing a ride */}
              {canViewEmergencyAndPhone && rider.phone && (
                <div className="mt-2 flex items-center gap-1.5 justify-center sm:justify-start text-sm text-t2w-muted">
                  <Phone className="h-3.5 w-3.5 text-t2w-accent/70" />
                  <span>{rider.phone}</span>
                </div>
              )}

              {/* Address: super admin or own profile only */}
              {canViewAllPersonalInfo && rider.address && (
                <div className="mt-2 flex items-start gap-1.5 justify-center sm:justify-start text-sm text-t2w-muted">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-t2w-accent/70" />
                  <span>{rider.address}</span>
                </div>
              )}

              <div className="mt-3 flex items-center gap-1.5 justify-center sm:justify-start text-sm text-t2w-muted">
                <Calendar className="h-3.5 w-3.5 text-t2w-accent/70" />
                <span>
                  Member since{" "}
                  {new Date(rider.joinDate).toLocaleDateString("en-IN", {
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>

              {/* Edit button - only visible if user can edit this profile */}
              {canEdit && !editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-t2w-surface-light px-4 py-2 text-sm font-medium text-t2w-accent transition-colors hover:bg-t2w-accent/20"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit Profile
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Edit Profile Form */}
        {editing && canEdit && (
          <div className="card mb-8">
            <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-white">
              <Pencil className="h-5 w-5 text-t2w-accent" />
              Edit Profile
              {isSuperAdmin && user?.linkedRiderId !== riderId && (
                <span className="ml-2 rounded-lg bg-t2w-accent/10 px-2 py-0.5 text-xs text-t2w-accent">
                  Super Admin Edit
                </span>
              )}
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-t2w-muted">
                  Full Name
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                  className="input-field"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-t2w-muted">
                  Email
                </label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) =>
                    setEditForm({ ...editForm, email: e.target.value })
                  }
                  className="input-field"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-t2w-muted">
                  Phone
                </label>
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={(e) =>
                    setEditForm({ ...editForm, phone: e.target.value })
                  }
                  className="input-field"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-t2w-muted">
                  Blood Group
                </label>
                <input
                  type="text"
                  value={editForm.bloodGroup}
                  onChange={(e) =>
                    setEditForm({ ...editForm, bloodGroup: e.target.value })
                  }
                  className="input-field"
                  placeholder="e.g. O+, A-, B+"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs text-t2w-muted">
                  Address
                </label>
                <input
                  type="text"
                  value={editForm.address}
                  onChange={(e) =>
                    setEditForm({ ...editForm, address: e.target.value })
                  }
                  className="input-field"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-t2w-muted">
                  Emergency Contact Name
                </label>
                <input
                  type="text"
                  value={editForm.emergencyContact}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      emergencyContact: e.target.value,
                    })
                  }
                  className="input-field"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-t2w-muted">
                  Emergency Contact Phone
                </label>
                <input
                  type="text"
                  value={editForm.emergencyPhone}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      emergencyPhone: e.target.value,
                    })
                  }
                  className="input-field"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <button
                onClick={handleSaveProfile}
                className="btn-primary flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                Save Changes
              </button>
              <button
                onClick={handleCancelEdit}
                className="flex items-center gap-2 rounded-xl bg-t2w-surface-light px-4 py-2 text-sm font-medium text-t2w-muted transition-colors hover:text-white"
              >
                <X className="h-4 w-4" />
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <div className="card text-center">
            <Bike className="mx-auto h-5 w-5 text-t2w-accent" />
            <div className="mt-2 font-display text-2xl font-bold text-white">
              {rider.ridesCompleted}
            </div>
            <div className="text-xs text-t2w-muted">Rides</div>
          </div>
          <div className="card text-center">
            <Gauge className="mx-auto h-5 w-5 text-t2w-gold" />
            <div className="mt-2 font-display text-2xl font-bold text-white">
              {rider.totalKm.toLocaleString()}
            </div>
            <div className="text-xs text-t2w-muted">Total KMs</div>
          </div>
          <div className="card text-center">
            <Flag className="mx-auto h-5 w-5 text-green-400" />
            <div className="mt-2 font-display text-2xl font-bold text-white">
              {rider.ridesOrganized}
            </div>
            <div className="text-xs text-t2w-muted">Organised</div>
          </div>
          <div className="card text-center">
            <Shield className="mx-auto h-5 w-5 text-blue-400" />
            <div className="mt-2 font-display text-2xl font-bold text-white">
              {rider.pilotsDone}
            </div>
            <div className="text-xs text-t2w-muted">Pilot</div>
          </div>
          <div className="card text-center">
            <ChevronDown className="mx-auto h-5 w-5 text-orange-400" />
            <div className="mt-2 font-display text-2xl font-bold text-white">
              {rider.sweepsDone}
            </div>
            <div className="text-xs text-t2w-muted">Sweep</div>
          </div>
          <div className="card text-center">
            <Heart className="mx-auto h-5 w-5 text-red-400" />
            <div className="mt-2 font-display text-2xl font-bold text-white">
              {rider.bloodGroup || "N/A"}
            </div>
            <div className="text-xs text-t2w-muted">Blood Group</div>
          </div>
        </div>

        {/* Emergency Contact - visible to super admin, own profile, or riders sharing a ride */}
        {canViewEmergencyAndPhone && rider.emergencyContact && (
          <div className="card mb-8">
            <h3 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-white">
              <Shield className="h-5 w-5 text-red-400" />
              Emergency Contact
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-t2w-surface-light p-4">
                <p className="text-xs text-t2w-muted">Contact Name</p>
                <p className="mt-1 font-medium text-white">
                  {rider.emergencyContact}
                </p>
              </div>
              {rider.emergencyPhone && (
                <div className="rounded-xl bg-t2w-surface-light p-4">
                  <p className="text-xs text-t2w-muted">Contact Phone</p>
                  <p className="mt-1 font-medium text-white">
                    {rider.emergencyPhone}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Ride History */}
        <div className="card">
          <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-white">
            <Bike className="h-5 w-5 text-t2w-accent" />
            Ride History ({rider.ridesParticipated.length})
          </h3>

          {rider.ridesParticipated.length === 0 ? (
            <p className="py-8 text-center text-t2w-muted">
              No rides completed yet.
            </p>
          ) : (
            <div className="space-y-3">
              {[...rider.ridesParticipated]
                .sort(
                  (a, b) =>
                    new Date(b.rideDate).getTime() -
                    new Date(a.rideDate).getTime()
                )
                .map((ride) => (
                  <Link
                    key={ride.rideId}
                    href={`/ride/${ride.rideId}`}
                    className="flex items-center gap-4 rounded-xl bg-t2w-surface-light p-4 transition-all hover:bg-t2w-surface-light/80 hover:ring-1 hover:ring-t2w-accent/30"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-t2w-accent/10 font-mono text-sm font-bold text-t2w-accent">
                      {ride.rideNumber}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-white truncate">
                        {ride.rideTitle}
                      </p>
                      <p className="text-xs text-t2w-muted">
                        {new Date(ride.rideDate).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-mono text-sm font-medium text-t2w-gold">
                        {ride.distanceKm.toLocaleString()} km
                      </span>
                    </div>
                  </Link>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
