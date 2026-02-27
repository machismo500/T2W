"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Calendar,
  MapPin,
  Users,
  ArrowLeft,
  Gauge,
  Route,
  Clock,
  DollarSign,
  Star,
  Shield,
  CheckCircle,
  AlertTriangle,
  Bike,
  User,
  IndianRupee,
  Loader2,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";

interface Ride {
  id: string;
  title: string;
  rideNumber: string;
  type: string;
  status: string;
  startDate: string;
  endDate: string;
  startLocation: string;
  endLocation: string;
  route: string[];
  highlights: string[];
  distanceKm: number;
  maxRiders: number;
  registeredRiders: number;
  difficulty: string;
  description: string;
  fee: number;
  leadRider: string;
  sweepRider: string;
  registrations: unknown[];
  riders?: string[];
}

export function RideDetailPage({ rideId }: { rideId: string }) {
  const { user } = useAuth();
  const [ride, setRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRegistration, setShowRegistration] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [confirmationCode, setConfirmationCode] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    api.rides
      .get(rideId)
      .then((data) => {
        if (cancelled) return;
        const result = data as { ride: Ride };
        const r = result.ride;
        // Ensure route and highlights are arrays (parse if they come as strings)
        if (typeof r.route === "string") {
          r.route = JSON.parse(r.route);
        }
        if (typeof r.highlights === "string") {
          r.highlights = JSON.parse(r.highlights);
        }
        setRide(r);
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

  const handleRegister = async () => {
    if (!agreed || registering) return;
    setRegistering(true);
    try {
      const data = (await api.rides.register(rideId, {
        agreedIndemnity: true,
      })) as { registration: unknown; confirmationCode: string };
      setRegistered(true);
      setConfirmationCode(data.confirmationCode);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Registration failed";
      alert(message);
    } finally {
      setRegistering(false);
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

  const spotsLeft = ride.maxRiders - ride.registeredRiders;
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
          Back to T2W Tales
        </Link>

        {/* Header */}
        <div className="mb-10">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`rounded-lg px-3 py-1 text-sm font-medium capitalize ${
                ride.status === "upcoming"
                  ? "bg-blue-400/10 text-blue-400"
                  : "bg-green-400/10 text-green-400"
              }`}
            >
              {ride.status}
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
        </div>

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

            {/* Ride Leaders */}
            <div className="card">
              <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-white">
                <Shield className="h-5 w-5 text-t2w-accent" />
                Ride Crew
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-center gap-4 rounded-xl bg-t2w-surface-light p-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-t2w-accent/10">
                    <User className="h-6 w-6 text-t2w-accent" />
                  </div>
                  <div>
                    <p className="text-xs text-t2w-muted">Lead Rider</p>
                    <p className="font-semibold text-white">{ride.leadRider}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 rounded-xl bg-t2w-surface-light p-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-t2w-gold/10">
                    <User className="h-6 w-6 text-t2w-gold" />
                  </div>
                  <div>
                    <p className="text-xs text-t2w-muted">Sweep Rider</p>
                    <p className="font-semibold text-white">
                      {ride.sweepRider}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Riders List - for completed rides with rider data */}
            {ride.status === "completed" && ride.riders && ride.riders.length > 0 && (
              <div className="card">
                <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-white">
                  <Users className="h-5 w-5 text-t2w-accent" />
                  Riders ({ride.riders.length})
                </h3>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {ride.riders.map((rider, index) => (
                    <div
                      key={`${rider}-${index}`}
                      className="flex items-center gap-3 rounded-xl bg-t2w-surface-light p-3"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-t2w-accent/10 text-xs font-bold text-t2w-accent">
                        {index + 1}
                      </div>
                      <span className="text-sm text-gray-300 truncate">
                        {rider}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Share Experience - for completed rides */}
            {ride.status === "completed" && (
              <div className="card">
                <h3 className="mb-4 font-display text-lg font-bold text-white">
                  Share Your Experience
                </h3>
                <p className="mb-4 text-sm text-t2w-muted">
                  Were you part of this ride? Share your personal experience with
                  the T2W community.
                </p>
                <textarea
                  rows={4}
                  className="input-field mb-4 resize-none"
                  placeholder="Write about your ride experience..."
                />
                <button className="btn-primary">Post Your Tale</button>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Registration Card */}
            {ride.status === "upcoming" && !registered && (
              <div className="card sticky top-28">
                <h3 className="mb-4 font-display text-lg font-bold text-white">
                  Register for this Ride
                </h3>

                {!user ? (
                  <div className="rounded-xl bg-t2w-surface-light p-4 text-center">
                    <p className="text-sm text-t2w-muted mb-3">
                      You must be logged in to register for a ride.
                    </p>
                    <Link href="/login" className="btn-primary inline-block">
                      Log In to Register
                    </Link>
                  </div>
                ) : spotsLeft > 0 ? (
                  <>
                    <div className="mb-4 rounded-xl bg-t2w-accent/10 p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-t2w-muted">
                          Registration Fee
                        </span>
                        <span className="font-display text-2xl font-bold text-t2w-accent">
                          ₹{ride.fee.toLocaleString()}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-t2w-muted">
                        {spotsLeft} spots remaining
                      </p>
                    </div>

                    {!showRegistration ? (
                      <button
                        onClick={() => setShowRegistration(true)}
                        className="btn-primary w-full"
                      >
                        Register Now
                      </button>
                    ) : (
                      <div className="space-y-4">
                        {/* Indemnity Form */}
                        <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/5 p-4">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-400" />
                            <div>
                              <h4 className="text-sm font-semibold text-yellow-400">
                                Indemnity Agreement
                              </h4>
                              <p className="mt-1 text-xs text-t2w-muted">
                                I understand that motorcycle riding involves
                                inherent risks. I voluntarily participate and
                                assume all risks. I release T2W from liability
                                for any injury or damage. I confirm I hold a
                                valid driving license and insurance.
                              </p>
                            </div>
                          </div>
                          <label className="mt-3 flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={agreed}
                              onChange={(e) => setAgreed(e.target.checked)}
                              className="h-4 w-4 rounded border-t2w-border accent-t2w-accent"
                            />
                            <span className="text-xs text-gray-300">
                              I agree to the indemnity terms
                            </span>
                          </label>
                        </div>

                        <button
                          disabled={!agreed || registering}
                          onClick={handleRegister}
                          className={`w-full rounded-xl py-3 text-sm font-semibold transition-all ${
                            agreed && !registering
                              ? "btn-primary"
                              : "cursor-not-allowed bg-t2w-surface-light text-t2w-muted"
                          }`}
                        >
                          {registering
                            ? "Processing..."
                            : `Confirm & Pay ₹${ride.fee.toLocaleString()}`}
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="rounded-xl bg-red-400/10 p-4 text-center">
                    <p className="text-sm font-medium text-red-400">
                      This ride is fully booked
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Registration Confirmation */}
            {registered && (
              <div className="card border-green-400/30 bg-green-400/5">
                <div className="text-center">
                  <CheckCircle className="mx-auto h-12 w-12 text-green-400" />
                  <h3 className="mt-3 font-display text-lg font-bold text-white">
                    Registration Confirmed!
                  </h3>
                  <p className="mt-2 text-sm text-t2w-muted">
                    You are registered for {ride.title}. Check your email for
                    ride details and meeting point information.
                  </p>
                  <div className="mt-4 rounded-xl bg-t2w-surface p-3 font-mono text-sm text-t2w-accent">
                    Confirmation #{confirmationCode}
                  </div>
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
                  <span className="font-medium text-white">
                    {ride.startLocation}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-t2w-muted">End</span>
                  <span className="font-medium text-white">
                    {ride.endLocation}
                  </span>
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
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
