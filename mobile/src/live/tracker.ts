import * as Location from "expo-location";
import { Platform } from "react-native";
import { ApiClientError } from "@/api/client";
import { LOCATION_TASK, setActiveRideId, getActiveRideId } from "./background-task";
import { postLiveLocations, type LiveLocationPoint } from "@/api/rides";
import { peek, dropFirst, size, clear } from "./queue";

export type StartTrackingOptions = {
  rideId: string;
  /** Sampling interval. Default 5 s in normal mode, 30 s in low-power mode. */
  intervalMs?: number;
  /** Minimum distance in metres between samples. Lower = denser path. */
  distanceFilterMeters?: number;
  /** If true, requests background permission (always allow) — needed for
   *  recording while screen is off / app backgrounded. */
  background: boolean;
};

const BATCH_SIZE = 50;
const FLUSH_INTERVAL_MS = 30_000;

let flushTimer: ReturnType<typeof setInterval> | null = null;
let flushing = false;

export type PermissionState = {
  foreground: Location.PermissionStatus;
  background: Location.PermissionStatus | "not-requested";
};

export async function checkPermissions(): Promise<PermissionState> {
  const fg = await Location.getForegroundPermissionsAsync();
  let bg: Location.PermissionStatus | "not-requested" = "not-requested";
  try {
    const bgPerm = await Location.getBackgroundPermissionsAsync();
    bg = bgPerm.status;
  } catch {
    bg = "not-requested";
  }
  return { foreground: fg.status, background: bg };
}

export async function requestPermissions(includeBackground: boolean): Promise<PermissionState> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== "granted") {
    return { foreground: fg.status, background: "not-requested" };
  }
  if (!includeBackground) return { foreground: fg.status, background: "not-requested" };
  const bg = await Location.requestBackgroundPermissionsAsync();
  return { foreground: fg.status, background: bg.status };
}

export async function startTracking(opts: StartTrackingOptions): Promise<void> {
  const perms = await checkPermissions();
  if (perms.foreground !== "granted") {
    throw new Error("Foreground location permission is required");
  }
  if (opts.background && perms.background !== "granted") {
    throw new Error("Background location permission is required");
  }

  await setActiveRideId(opts.rideId);

  const interval = opts.intervalMs ?? 5_000;
  const distanceFilter = opts.distanceFilterMeters ?? 5;

  const already = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
  if (already) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  }

  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: interval,
    distanceInterval: distanceFilter,
    showsBackgroundLocationIndicator: true,
    foregroundService:
      Platform.OS === "android"
        ? {
            notificationTitle: "T2W is tracking your ride",
            notificationBody: "GPS continues until you end the ride or leave the live session.",
            notificationColor: "#ff4757",
          }
        : undefined,
    activityType: Location.ActivityType.AutomotiveNavigation,
    pausesUpdatesAutomatically: false,
  });

  if (flushTimer) clearInterval(flushTimer);
  flushTimer = setInterval(() => {
    void flushOnce(opts.rideId);
  }, FLUSH_INTERVAL_MS);

  // First flush almost immediately so anything left from a prior session is sent.
  void flushOnce(opts.rideId);
}

export async function stopTracking(): Promise<void> {
  const rideId = await getActiveRideId();
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
  const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
  if (running) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  }
  if (rideId) {
    // Final drain — best-effort; if it fails the points remain queued.
    await flushOnce(rideId);
  }
  await setActiveRideId(null);
}

export async function flushOnce(rideId: string): Promise<{ flushed: number; pending: number }> {
  if (flushing) return { flushed: 0, pending: await size(rideId) };
  flushing = true;
  try {
    const batch = await peek(rideId, BATCH_SIZE);
    if (batch.length === 0) return { flushed: 0, pending: 0 };

    const payload: LiveLocationPoint[] = batch.map((p) => ({
      lat: p.lat,
      lng: p.lng,
      speed: p.speed,
      heading: p.heading,
      accuracy: p.accuracy,
      recordedAt: p.recordedAt,
    }));

    try {
      const res = await postLiveLocations(rideId, payload);
      // Drop the entire batch — the server response tells us which points
      // were rejected, but those rejections are deterministic (>24h old,
      // future timestamp, malformed numbers). Re-queueing them would just
      // make us loop forever. We log permanent-reject counts to Sentry so
      // we can spot a systematic issue.
      if (res.rejected.length > 0) {
        console.warn(
          `[T2W][live] server rejected ${res.rejected.length}/${batch.length} points for ride ${rideId}`,
          res.rejected.slice(0, 3),
        );
      }
      await dropFirst(rideId, batch.length);
      return { flushed: res.accepted, pending: await size(rideId) };
    } catch (err) {
      // Network errors retry; 4xx other than the per-point rejections
      // above means the whole batch is invalid (e.g. no active session)
      // — drop it so we don't loop forever. The user sees the ride status
      // banner change to "Session ended" on the next poll.
      if (err instanceof ApiClientError) {
        if (err.kind === "validation" && err.code === "CONFLICT") {
          console.warn(
            `[T2W][live] session inactive for ride ${rideId}; dropping batch`,
          );
          await dropFirst(rideId, batch.length);
          return { flushed: 0, pending: await size(rideId) };
        }
        if (err.kind === "auth") {
          // The HTTP client will refresh on the next call. Don't drop the batch.
          return { flushed: 0, pending: await size(rideId) };
        }
      }
      console.warn("[T2W][live] flush failed; will retry:", err);
      return { flushed: 0, pending: await size(rideId) };
    }
  } finally {
    flushing = false;
  }
}

/**
 * Reattach the in-process flush timer to an already-running TaskManager
 * background task. Call on app launch when `isTracking()` reports active
 * for a known ride — the OS task survives app death but our JS-side
 * flusher doesn't, so we need to relight it.
 */
export async function resumeFlusherIfActive(): Promise<{ resumed: boolean; rideId: string | null }> {
  const status = await isTracking();
  if (!status.active || !status.rideId) return { resumed: false, rideId: status.rideId };
  if (flushTimer) {
    // Already attached — nothing to do.
    return { resumed: true, rideId: status.rideId };
  }
  const rideId = status.rideId;
  flushTimer = setInterval(() => {
    void flushOnce(rideId);
  }, FLUSH_INTERVAL_MS);
  void flushOnce(rideId);
  return { resumed: true, rideId };
}

export async function pendingCount(rideId: string): Promise<number> {
  return size(rideId);
}

export async function clearQueueForRide(rideId: string): Promise<void> {
  await clear(rideId);
}

export async function isTracking(): Promise<{ active: boolean; rideId: string | null }> {
  const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
  const rideId = await getActiveRideId();
  return { active: running, rideId };
}
