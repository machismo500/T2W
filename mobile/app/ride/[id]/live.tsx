import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { Stack, useLocalSearchParams, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/Button";
import { MetricsBar } from "@/components/MetricsBar";
import { useIsOffline } from "@/lib/network";
import { getLive, getLiveMetrics, joinLive } from "@/api/rides";
import {
  checkPermissions,
  requestPermissions,
  startTracking,
  stopTracking,
  pendingCount,
  isTracking,
  resumeFlusherIfActive,
} from "@/live/tracker";
import { useAuth } from "@/auth/AuthProvider";
import { colors, radius, spacing, text } from "@/theme";

export default function LiveRideScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const auth = useAuth();
  const offline = useIsOffline();
  const [tracking, setTracking] = useState(false);
  const [pending, setPending] = useState(0);
  const [starting, setStarting] = useState(false);
  const sinceRef = useRef<string | null>(null);

  // Discover whether we're already tracking when the screen mounts. Two
  // cases to handle:
  //   1. App killed mid-ride and relaunched — TaskManager is still alive
  //      but our in-process flusher isn't. resumeFlusherIfActive() reattaches.
  //   2. Tracking was running for a *different* ride — just reflect that in
  //      the UI; the user can navigate to it from the prompt elsewhere.
  useEffect(() => {
    (async () => {
      const status = await isTracking();
      setTracking(status.active && status.rideId === id);
      if (status.active && status.rideId === id) {
        await resumeFlusherIfActive();
      }
    })();
  }, [id]);

  const live = useQuery({
    queryKey: ["live", id],
    queryFn: () => getLive(id, sinceRef.current),
    enabled: typeof id === "string",
    refetchInterval: 5_000,
  });

  // Advance the delta cursor whenever we receive fresh path points.
  useEffect(() => {
    const leadLast = live.data?.leadPath.at(-1)?.recordedAt;
    const myLast = live.data?.myPath.at(-1)?.recordedAt;
    const latest = [leadLast, myLast].filter(Boolean).sort().pop();
    if (latest) sinceRef.current = latest;
  }, [live.data]);

  const metrics = useQuery({
    queryKey: ["live-metrics", id],
    queryFn: () => getLiveMetrics(id),
    enabled: typeof id === "string" && !!live.data?.session,
    refetchInterval: 10_000,
  });

  // Sample the pending-queue size periodically so the UI shows what's still
  // buffered locally (offline visibility for the rider).
  useEffect(() => {
    if (!tracking) return;
    const t = setInterval(() => {
      void pendingCount(id).then(setPending);
    }, 5_000);
    return () => clearInterval(t);
  }, [id, tracking]);

  const session = live.data?.session;
  const riders = live.data?.riders ?? [];
  const myPath = live.data?.myPath ?? [];
  const leadPath = live.data?.leadPath ?? [];

  const initialRegion = useMemo(() => {
    const anchor =
      myPath.at(-1) ??
      leadPath.at(-1) ??
      riders[0] ??
      (session?.plannedRoute?.[0] ? { lat: session.plannedRoute[0].lat, lng: session.plannedRoute[0].lng } : null);
    if (!anchor) return undefined;
    return {
      latitude: "latitude" in anchor ? (anchor as { latitude: number }).latitude : anchor.lat,
      longitude: "longitude" in anchor ? (anchor as { longitude: number }).longitude : anchor.lng,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    };
  }, [myPath, leadPath, riders, session?.plannedRoute]);

  async function handleStart() {
    setStarting(true);
    try {
      const join = await joinLive(id);
      if (join.session.status === "ended") {
        Alert.alert("Session ended", "The live session for this ride has already ended.");
        return;
      }

      const perms = await checkPermissions();
      if (perms.foreground !== "granted" || perms.background !== "granted") {
        const requested = await requestPermissions(true);
        if (requested.foreground !== "granted") {
          Alert.alert(
            "Permission required",
            "T2W needs location access to track your ride.",
            [
              { text: "Cancel" },
              { text: "Open Settings", onPress: () => Linking.openSettings() },
            ],
          );
          return;
        }
        if (requested.background !== "granted") {
          Alert.alert(
            "Background access recommended",
            "Without 'Always Allow', tracking pauses when the screen is off. You can enable it in Settings.",
            [
              { text: "Continue without", onPress: () => void doStart() },
              { text: "Open Settings", onPress: () => Linking.openSettings() },
            ],
          );
          return;
        }
      }
      await doStart();
    } catch (err) {
      Alert.alert("Couldn't start tracking", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setStarting(false);
    }
  }

  async function doStart() {
    await startTracking({ rideId: id, background: true });
    setTracking(true);
  }

  async function handleStop() {
    Alert.alert(
      "Stop tracking?",
      "This will stop background GPS and flush any remaining points.",
      [
        { text: "Keep tracking" },
        {
          text: "Stop",
          style: "destructive",
          onPress: async () => {
            await stopTracking();
            setTracking(false);
            setPending(0);
          },
        },
      ],
    );
  }

  if (!session && live.isLoading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (!session) {
    return (
      <Screen>
        <Stack.Screen options={{ title: "Live" }} />
        <View style={styles.padding}>
          <Text style={text.h2}>No live session yet</Text>
          <Text style={[text.bodySecondary, { marginTop: spacing.sm }]}>
            The lead rider or T2W admin hasn't started this ride's live session.
            You'll be able to join from this screen once they do.
          </Text>
          <Button
            label="Back to ride"
            variant="secondary"
            onPress={() => router.back()}
            style={{ marginTop: spacing.lg }}
          />
        </View>
      </Screen>
    );
  }

  const meId = auth.status === "authed" ? auth.user.id : null;
  const me = riders.find((r) => r.userId === meId);

  return (
    <Screen edges={["left", "right"]}>
      <Stack.Screen options={{ title: "Live ride" }} />

      <View style={styles.mapContainer}>
        {initialRegion ? (
          <MapView
            style={StyleSheet.absoluteFill}
            provider={PROVIDER_GOOGLE}
            initialRegion={initialRegion}
            showsUserLocation={false}
          >
            {session.plannedRoute && session.plannedRoute.length > 1 ? (
              <Polyline
                coordinates={session.plannedRoute.map((p) => ({
                  latitude: p.lat,
                  longitude: p.lng,
                }))}
                strokeColor="#7fb3ff"
                strokeWidth={3}
              />
            ) : null}
            {leadPath.length > 1 ? (
              <Polyline
                coordinates={leadPath.map((p) => ({ latitude: p.lat, longitude: p.lng }))}
                strokeColor={colors.primary}
                strokeWidth={4}
              />
            ) : null}
            {myPath.length > 1 ? (
              <Polyline
                coordinates={myPath.map((p) => ({ latitude: p.lat, longitude: p.lng }))}
                strokeColor="#22c55e"
                strokeWidth={3}
              />
            ) : null}
            {riders.map((r) => (
              <Marker
                key={r.userId}
                coordinate={{ latitude: r.lat, longitude: r.lng }}
                title={r.userName}
                description={
                  r.isLead ? "Lead rider" : r.isSweep ? "Sweep rider" : undefined
                }
                pinColor={r.isLead ? "red" : r.isSweep ? "orange" : "green"}
              />
            ))}
            {session.breaks
              .filter((b) => !b.endedAt && me)
              .map((b) =>
                me ? (
                  <Marker
                    key={b.id}
                    coordinate={{ latitude: me.lat, longitude: me.lng }}
                    pinColor="purple"
                    title={`Break: ${b.reason ?? "Resting"}`}
                  />
                ) : null,
              )}
          </MapView>
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.center]}>
            <Text style={text.bodySecondary}>Waiting for first GPS fix…</Text>
          </View>
        )}
        {offline ? (
          <View style={styles.mapOfflineHint}>
            <Text style={styles.mapOfflineHintText}>
              Offline — map tiles unavailable, polyline + markers only
            </Text>
          </View>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={styles.bottom}>
        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: session.status === "live" ? colors.success : colors.warning },
            ]}
          />
          <Text style={styles.statusText}>
            {session.status === "live"
              ? "Session live"
              : session.status === "paused"
                ? `Session paused${session.breaks.find((b) => !b.endedAt)?.reason ? ` — ${session.breaks.find((b) => !b.endedAt)?.reason}` : ""}`
                : "Session ended"}
          </Text>
        </View>

        {metrics.data ? (
          <>
            <MetricsBar
              metrics={[
                { label: "Distance", value: `${metrics.data.group.distanceKm} km` },
                { label: "Moving", value: `${metrics.data.group.movingMinutes}m` },
                { label: "Avg", value: `${metrics.data.group.avgSpeedKmh} km/h` },
              ]}
            />
            <Text style={styles.section}>Your ride</Text>
            <MetricsBar
              metrics={[
                { label: "Distance", value: `${metrics.data.me.distanceKm} km` },
                { label: "Max", value: `${metrics.data.me.maxSpeedKmh} km/h` },
                { label: "Avg", value: `${metrics.data.me.avgSpeedKmh} km/h` },
              ]}
            />
          </>
        ) : null}

        {tracking ? (
          <>
            <Text style={[text.caption, { marginTop: spacing.md }]}>
              {pending === 0
                ? "All breadcrumbs uploaded."
                : `${pending} point${pending === 1 ? "" : "s"} queued (will flush automatically)`}
            </Text>
            <Button
              label="Stop tracking"
              variant="secondary"
              onPress={handleStop}
              style={{ marginTop: spacing.md }}
            />
          </>
        ) : (
          <Button
            label={starting ? "Joining…" : "Start tracking my ride"}
            onPress={handleStart}
            loading={starting}
            style={{ marginTop: spacing.md }}
          />
        )}

        {Platform.OS === "android" ? (
          <Text style={[text.caption, { marginTop: spacing.md }]}>
            Some Android OEMs aggressively kill background services. If GPS stops
            recording when your screen is off, disable battery optimisation for
            Tales on 2 Wheels in your device Settings.
          </Text>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  mapContainer: {
    height: 360,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  mapOfflineHint: {
    position: "absolute",
    bottom: spacing.sm,
    left: spacing.sm,
    right: spacing.sm,
    backgroundColor: "rgba(15, 15, 30, 0.85)",
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  mapOfflineHintText: { color: "#fff", fontSize: 12, textAlign: "center" },
  bottom: { padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.sm },
  statusRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  statusDot: { width: 10, height: 10, borderRadius: radius.pill },
  statusText: { color: colors.textPrimary, fontWeight: "600" },
  section: {
    color: colors.textSecondary,
    marginTop: spacing.md,
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  padding: { padding: spacing.lg },
});
