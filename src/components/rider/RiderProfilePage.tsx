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
} from "lucide-react";
import { api } from "@/lib/api-client";
import type { RiderProfile } from "@/data/rider-profiles";

export function RiderProfilePage({ riderId }: { riderId: string }) {
  const [rider, setRider] = useState<RiderProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.riders
      .get(riderId)
      .then((data: any) => {
        setRider(data.rider);
        // Load saved avatar from localStorage
        const saved = localStorage.getItem(`t2w_avatar_${riderId}`);
        if (saved) setAvatarUrl(saved);
      })
      .catch((err) => {
        setError(err.message || "Failed to load rider");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [riderId]);

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
      localStorage.setItem(`t2w_avatar_${riderId}`, dataUrl);
    };
    reader.readAsDataURL(file);
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

  // Determine badge based on ride count
  let badge = { name: "New Rider", color: "text-gray-400", bg: "bg-gray-400/10" };
  if (rider.ridesCompleted >= 20) {
    badge = { name: "Legend", color: "text-yellow-300", bg: "bg-yellow-300/10" };
  } else if (rider.ridesCompleted >= 15) {
    badge = { name: "Ace Rider", color: "text-purple-400", bg: "bg-purple-400/10" };
  } else if (rider.ridesCompleted >= 10) {
    badge = { name: "Veteran", color: "text-t2w-gold", bg: "bg-t2w-gold/10" };
  } else if (rider.ridesCompleted >= 5) {
    badge = { name: "Regular", color: "text-t2w-accent", bg: "bg-t2w-accent/10" };
  } else if (rider.ridesCompleted >= 2) {
    badge = { name: "Explorer", color: "text-green-400", bg: "bg-green-400/10" };
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

              <div className="mt-3 flex flex-wrap items-center justify-center gap-4 sm:justify-start">
                {rider.email && (
                  <div className="flex items-center gap-1.5 text-sm text-t2w-muted">
                    <Mail className="h-3.5 w-3.5 text-t2w-accent/70" />
                    <span>{rider.email}</span>
                  </div>
                )}
                {rider.phone && (
                  <div className="flex items-center gap-1.5 text-sm text-t2w-muted">
                    <Phone className="h-3.5 w-3.5 text-t2w-accent/70" />
                    <span>{rider.phone}</span>
                  </div>
                )}
              </div>

              {rider.address && (
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
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="card text-center">
            <Bike className="mx-auto h-6 w-6 text-t2w-accent" />
            <div className="mt-2 font-display text-2xl font-bold text-white">
              {rider.ridesCompleted}
            </div>
            <div className="text-xs text-t2w-muted">Rides Completed</div>
          </div>
          <div className="card text-center">
            <Calendar className="mx-auto h-6 w-6 text-t2w-gold" />
            <div className="mt-2 font-display text-2xl font-bold text-white">
              {rider.ridesParticipated.length > 0
                ? new Date(
                    rider.ridesParticipated[
                      rider.ridesParticipated.length - 1
                    ].rideDate
                  ).toLocaleDateString("en-IN", {
                    month: "short",
                    year: "2-digit",
                  })
                : "N/A"}
            </div>
            <div className="text-xs text-t2w-muted">Last Ride</div>
          </div>
          <div className="card text-center">
            <Award className="mx-auto h-6 w-6 text-green-400" />
            <div className="mt-2 font-display text-2xl font-bold text-white">
              {badge.name}
            </div>
            <div className="text-xs text-t2w-muted">Badge</div>
          </div>
          <div className="card text-center">
            <Heart className="mx-auto h-6 w-6 text-red-400" />
            <div className="mt-2 font-display text-2xl font-bold text-white">
              {rider.bloodGroup || "N/A"}
            </div>
            <div className="text-xs text-t2w-muted">Blood Group</div>
          </div>
        </div>

        {/* Emergency Contact */}
        {rider.emergencyContact && (
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
                    href={`/ride?id=${ride.rideId}`}
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
                    <span className="rounded-lg bg-green-400/10 px-2.5 py-1 text-xs font-medium text-green-400">
                      Completed
                    </span>
                  </Link>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
