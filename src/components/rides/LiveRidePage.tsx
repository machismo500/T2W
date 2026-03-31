"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, WifiOff, Wifi } from "lucide-react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";
import { useOnlineStatus } from "@/hooks/use-online-status";
import {
  enqueueLocation,
  flushLocationQueue,
  getPendingCount,
} from "@/lib/location-queue";
import { LiveRideMap } from "./LiveRideMap";
import { LiveRideControls } from "./LiveRideControls";
import { LiveRideMetrics } from "./LiveRideMetrics";
import { LiveRidePostView } from "./LiveRidePostView";
import type {
  LiveRideSession,
  LiveRiderLocation,
  LiveRideMetrics as Metrics,
} from "@/types";

const POLL_INTERVAL = 5000; // 5 seconds
const LOCATION_INTERVAL = 5000; // 5 seconds

interface LiveRidePageProps {
  rideId: string;
  rideTitle?: string;
}

export function LiveRidePage({ rideId, rideTitle }: LiveRidePageProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [session, setSession] = useState<LiveRideSession | null>(null);
  const [riders, setRiders] = useState<LiveRiderLocation[]>([]);
  const [leadPath, setLeadPath] = useState<{ lat: number; lng: number }[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOnline = useOnlineStatus();
  const [queuedCount, setQueuedCount] = useState(0);
  const [justReconnected, setJustReconnected] = useState(false);

  const watchIdRef = useRef<number | null>(null);
  const locationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastCoordsRef = useRef<{ lat: number; lng: number; speed: number | null; heading: number | null; accuracy: number | null } | null>(null);

  const isAdmin = user?.role === "superadmin" || user?.role === "core_member";

  // Load Google Maps script
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      setError("Google Maps API key not configured");
      return;
    }

    if (window.google?.maps) {
      setMapsLoaded(true);
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry,marker&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = () => setMapsLoaded(true);
    script.onerror = () => setError("Failed to load Google Maps");
    document.head.appendChild(script);

    return () => {
      // Don't remove script on unmount (it persists)
    };
  }, []);

  // Fetch session data (polling)
  const fetchSession = useCallback(async () => {
    try {
      const data = await api.liveSession.get(rideId);
      setSession(data.session);
      setRiders(data.riders || []);
      setLeadPath(data.leadPath || []);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch session:", err);
    }
  }, [rideId]);

  // Fetch metrics
  const fetchMetrics = useCallback(async () => {
    try {
      const data = await api.liveSession.metrics(rideId);
      setMetrics(data);
    } catch {
      // metrics are optional, ignore errors
    }
  }, [rideId]);

  // Initial load
  useEffect(() => {
    async function init() {
      await fetchSession();
      await fetchMetrics();
      setLoading(false);
    }
    init();
  }, [fetchSession, fetchMetrics]);

  // Polling
  useEffect(() => {
    if (!session || session.status === "ended") return;

    const interval = setInterval(() => {
      fetchSession();
      fetchMetrics();
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [session?.status, fetchSession, fetchMetrics]);

  // Also fetch metrics once for ended sessions
  useEffect(() => {
    if (session?.status === "ended" && !metrics) {
      fetchMetrics();
    }
  }, [session?.status, metrics, fetchMetrics]);

  // Submit a single GPS ping — queue it locally if the network is down
  const submitLocationOrQueue = useCallback(
    async (coords: { lat: number; lng: number; speed?: number | null; heading?: number | null; accuracy?: number | null }) => {
      try {
        await api.liveSession.submitLocation(rideId, {
          lat: coords.lat,
          lng: coords.lng,
          speed: coords.speed ?? undefined,
          heading: coords.heading ?? undefined,
          accuracy: coords.accuracy ?? undefined,
        });
      } catch {
        // Network failed — queue the ping for later replay
        await enqueueLocation({
          rideId,
          lat: coords.lat,
          lng: coords.lng,
          speed: coords.speed,
          heading: coords.heading,
          accuracy: coords.accuracy,
          timestamp: Date.now(),
        });
        setQueuedCount((c) => c + 1);

        // Register a Background Sync event so the SW can flush when online
        if ("serviceWorker" in navigator && "SyncManager" in window) {
          navigator.serviceWorker.ready
            .then((reg) => (reg as ServiceWorkerRegistration & { sync?: { register: (tag: string) => Promise<void> } }).sync?.register("flush-locations"))
            .catch(() => {});
        }
      }
    },
    [rideId]
  );

  // GPS tracking
  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    // Watch position for continuous updates (GPS works without network)
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        lastCoordsRef.current = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          speed: position.coords.speed ? position.coords.speed * 3.6 : null, // m/s → km/h
          heading: position.coords.heading,
          accuracy: position.coords.accuracy,
        };
      },
      (err) => {
        console.error("Geolocation error:", err);
        if (err.code === err.PERMISSION_DENIED) {
          alert("Location permission denied. Please enable GPS to track your ride.");
          setIsTracking(false);
        }
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    );
    watchIdRef.current = watchId;

    // Send (or queue) location every LOCATION_INTERVAL
    const timer = setInterval(async () => {
      if (lastCoordsRef.current) {
        await submitLocationOrQueue(lastCoordsRef.current);
      }
    }, LOCATION_INTERVAL);
    locationTimerRef.current = timer;

    setIsTracking(true);
  }, [submitLocationOrQueue]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (locationTimerRef.current) {
      clearInterval(locationTimerRef.current);
      locationTimerRef.current = null;
    }
    lastCoordsRef.current = null;
    setIsTracking(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, [stopTracking]);

  // Refresh queued count on mount and after re-render
  useEffect(() => {
    getPendingCount(rideId).then(setQueuedCount).catch(() => {});
  }, [rideId]);

  // When connectivity is restored, flush the offline queue
  useEffect(() => {
    if (!isOnline) return;
    flushLocationQueue(rideId, (coords) =>
      api.liveSession.submitLocation(rideId, {
        lat: coords.lat,
        lng: coords.lng,
        speed: coords.speed ?? undefined,
        heading: coords.heading ?? undefined,
        accuracy: coords.accuracy ?? undefined,
      })
    )
      .then((flushed) => {
        if (flushed > 0) {
          setQueuedCount(0);
          setJustReconnected(true);
          setTimeout(() => setJustReconnected(false), 4000);
        }
      })
      .catch(() => {});
  }, [isOnline, rideId]);

  // Handlers
  const handleStart = async () => {
    try {
      await api.liveSession.control(rideId, "start");
      await fetchSession();
    } catch (err) {
      alert("Failed to start session");
      console.error(err);
    }
  };

  const handlePause = async () => {
    try {
      await api.liveSession.control(rideId, "pause");
      await fetchSession();
    } catch (err) {
      alert("Failed to pause session");
      console.error(err);
    }
  };

  const handleResume = async () => {
    try {
      await api.liveSession.control(rideId, "resume");
      await fetchSession();
    } catch (err) {
      alert("Failed to resume session");
      console.error(err);
    }
  };

  const handleEnd = async () => {
    try {
      stopTracking();
      await api.liveSession.control(rideId, "end");
      await fetchSession();
      await fetchMetrics();
    } catch (err) {
      alert("Failed to end session");
      console.error(err);
    }
  };

  const handleJoin = async () => {
    try {
      await api.liveSession.join(rideId);
      setHasJoined(true);
      startTracking();
    } catch (err) {
      alert("Failed to join session");
      console.error(err);
    }
  };

  const handleToggleTracking = () => {
    if (isTracking) {
      stopTracking();
    } else {
      startTracking();
    }
  };

  const handleBreakStart = async (reason?: string) => {
    try {
      await api.liveSession.breakControl(rideId, "start", reason);
      await fetchSession();
    } catch (err) {
      alert("Failed to start break");
      console.error(err);
    }
  };

  const handleBreakEnd = async () => {
    try {
      await api.liveSession.breakControl(rideId, "end");
      await fetchSession();
    } catch (err) {
      alert("Failed to end break");
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error && !mapsLoaded) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-4">
        <p className="text-red-500 font-medium">{error}</p>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Go Back
        </button>
      </div>
    );
  }

  // Post-ride view
  if (session?.status === "ended") {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <button
          onClick={() => router.push(`/ride/${rideId}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Ride
        </button>
        {mapsLoaded && (
          <LiveRidePostView
            rideTitle={rideTitle || "Ride"}
            plannedRoute={session.plannedRoute}
            leadPath={leadPath}
            riders={riders}
            metrics={metrics}
            startLocation={session.plannedRoute?.[0]}
            endLocation={
              session.plannedRoute
                ? session.plannedRoute[session.plannedRoute.length - 1]
                : undefined
            }
          />
        )}
      </div>
    );
  }

  // Live view
  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 shadow-sm z-10">
        <button
          onClick={() => router.push(`/ride/${rideId}`)}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 dark:text-white" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold dark:text-white truncate">
            {rideTitle || "Live Ride"}
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {riders.length} rider{riders.length !== 1 ? "s" : ""} on map
          </p>
        </div>
        {/* Online/offline pill */}
        {!isOnline && (
          <div className="flex items-center gap-1.5 rounded-full bg-orange-500/20 px-2.5 py-1 text-xs font-medium text-orange-400">
            <WifiOff className="h-3.5 w-3.5" />
            Offline{queuedCount > 0 ? ` · ${queuedCount} queued` : ""}
          </div>
        )}
        {isOnline && justReconnected && (
          <div className="flex items-center gap-1.5 rounded-full bg-green-500/20 px-2.5 py-1 text-xs font-medium text-green-400">
            <Wifi className="h-3.5 w-3.5" />
            Back online · synced
          </div>
        )}
      </div>

      {/* Offline notice banner — shown when tracking but no network */}
      {!isOnline && isTracking && (
        <div className="flex items-start gap-2 bg-orange-500/10 border-b border-orange-500/20 px-4 py-2.5 text-xs text-orange-300">
          <WifiOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            No network — GPS is still running.{" "}
            {queuedCount > 0
              ? `${queuedCount} location ping${queuedCount !== 1 ? "s" : ""} saved on device and will upload automatically when signal returns.`
              : "Your location will be saved on device and uploaded when signal returns."}
          </span>
        </div>
      )}

      {/* Map */}
      <div className="flex-1 relative">
        {mapsLoaded && (
          <LiveRideMap
            plannedRoute={session?.plannedRoute}
            leadPath={leadPath}
            riders={riders}
            startLocation={session?.plannedRoute?.[0]}
            endLocation={
              session?.plannedRoute
                ? session.plannedRoute[session.plannedRoute.length - 1]
                : undefined
            }
          />
        )}

        {/* Metrics overlay (top-right) */}
        {(session?.status === "live" || session?.status === "paused") && (
          <div className="absolute top-3 right-3 w-64">
            <LiveRideMetrics metrics={metrics} isLoading={!metrics} />
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div className="p-3 bg-transparent">
        <LiveRideControls
          session={session}
          isAdmin={isAdmin}
          isTracking={isTracking}
          hasJoined={hasJoined}
          onStart={handleStart}
          onPause={handlePause}
          onResume={handleResume}
          onEnd={handleEnd}
          onJoin={handleJoin}
          onToggleTracking={handleToggleTracking}
          onBreakStart={handleBreakStart}
          onBreakEnd={handleBreakEnd}
        />
      </div>
    </div>
  );
}
