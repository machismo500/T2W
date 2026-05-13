import React, { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import * as Sharing from "expo-sharing";
import { captureRef } from "react-native-view-shot";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/Button";
import {
  SHARE_CARD_HEIGHT,
  SHARE_CARD_WIDTH,
  ShareableRideCard,
  type ShareStat,
} from "@/components/ShareableRideCard";
import { getRide, getLiveMetrics } from "@/api/rides";
import { useAuth } from "@/auth/AuthProvider";
import { colors, radius, spacing, text } from "@/theme";

/**
 * Post-ride share card.
 *
 * Renders a 1080×1920 native view off-screen, lets the rider pick a photo
 * and 4 stats, then captures the view with react-native-view-shot and
 * opens the native share sheet. Matches the web ShareableRideCard output
 * so the brand looks the same on Instagram / WhatsApp regardless of where
 * the rider posted from.
 */

const AVAILABLE_STATS = (metrics: Awaited<ReturnType<typeof getLiveMetrics>>): ShareStat[] => [
  { label: "Distance", value: `${metrics.me.distanceKm} km` },
  { label: "Moving time", value: `${metrics.me.movingMinutes}m` },
  { label: "Avg speed", value: `${metrics.me.avgSpeedKmh} km/h` },
  { label: "Max speed", value: `${metrics.me.maxSpeedKmh} km/h` },
  { label: "Group km", value: `${metrics.group.distanceKm} km` },
  { label: "Riders", value: `${metrics.group.riderCount}` },
  { label: "Breaks", value: `${metrics.group.closedBreaks}` },
];

export default function ShareScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const auth = useAuth();
  const cardRef = useRef<View>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>(["Distance", "Avg speed", "Moving time", "Riders"]);
  const [busy, setBusy] = useState(false);

  const ride = useQuery({ queryKey: ["ride", id], queryFn: () => getRide(id) });
  const metrics = useQuery({ queryKey: ["live-metrics", id], queryFn: () => getLiveMetrics(id) });

  const allStats = useMemo(() => (metrics.data ? AVAILABLE_STATS(metrics.data) : []), [metrics.data]);
  const chosen = useMemo(
    () => allStats.filter((s) => selected.includes(s.label)).slice(0, 4),
    [allStats, selected],
  );

  function toggleStat(label: string) {
    setSelected((curr) => {
      if (curr.includes(label)) return curr.filter((l) => l !== label);
      if (curr.length >= 4) return curr;
      return [...curr, label];
    });
  }

  async function pickPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission required", "T2W needs photo access to set the background.");
      return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.9,
    });
    if (!r.canceled && r.assets.length > 0) setPhotoUri(r.assets[0].uri);
  }

  async function shareIt() {
    if (!cardRef.current) return;
    setBusy(true);
    try {
      const uri = await captureRef(cardRef, {
        format: "png",
        quality: 1,
        width: SHARE_CARD_WIDTH,
        height: SHARE_CARD_HEIGHT,
        result: "tmpfile",
      });
      const can = await Sharing.isAvailableAsync();
      if (!can) {
        Alert.alert("Sharing unavailable on this device.");
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: "image/png",
        dialogTitle: "Share your ride",
      });
    } catch (err) {
      Alert.alert("Failed to share", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  if (ride.isLoading || metrics.isLoading || !ride.data || !metrics.data) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  const subtitle = `${ride.data.startLocation} → ${ride.data.endLocation}`;
  const riderName = auth.status === "authed" ? auth.user.name : "Rider";

  return (
    <Screen>
      <Stack.Screen options={{ title: "Share your ride" }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* The actual capture target — full 1080×1920, parked off-screen.
            view-shot captures it at intrinsic size regardless of where it
            sits in the layout. */}
        <View style={styles.offscreen} pointerEvents="none">
          <View ref={cardRef} collapsable={false}>
            <ShareableRideCard
              title={ride.data.title}
              subtitle={subtitle}
              photoUri={photoUri}
              stats={chosen}
              riderName={riderName}
            />
          </View>
        </View>

        {/* On-screen thumbnail preview built from the same inputs. */}
        <View style={styles.previewThumb}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.previewPhoto} />
          ) : (
            <View style={[styles.previewPhoto, { backgroundColor: colors.bgElevated }]} />
          )}
          <View style={styles.previewOverlay} />
          <View style={styles.previewContent}>
            <Text style={styles.previewBrand}>TALES ON 2 WHEELS</Text>
            <Text style={styles.previewTitle} numberOfLines={2}>{ride.data.title}</Text>
            <Text style={styles.previewSubtitle} numberOfLines={1}>{subtitle}</Text>
            <View style={styles.previewStats}>
              {chosen.map((s) => (
                <View key={s.label} style={styles.previewStat}>
                  <Text style={styles.previewStatValue}>{s.value}</Text>
                  <Text style={styles.previewStatLabel}>{s.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <Button
          label={photoUri ? "Change background photo" : "Pick a background photo"}
          variant="secondary"
          onPress={pickPhoto}
        />

        <Text style={[text.h3, { marginTop: spacing.lg }]}>Pick up to 4 stats</Text>
        <View style={styles.statsChips}>
          {allStats.map((s) => {
            const active = selected.includes(s.label);
            return (
              <Pressable
                key={s.label}
                onPress={() => toggleStat(s.label)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {s.label} · {s.value}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Button
          label={busy ? "Preparing…" : "Share"}
          onPress={shareIt}
          loading={busy}
          style={{ marginTop: spacing.lg }}
        />
        {photoUri ? (
          <Image
            source={{ uri: photoUri }}
            style={{ width: 0, height: 0 }}
            // The captureRef call uses the rendered card; we don't need to
            // do anything with this hidden image, but keeping a reference
            // prevents the picker URI from being garbage-collected on iOS.
          />
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.sm },
  offscreen: {
    position: "absolute",
    left: -10_000,
    top: 0,
  },
  previewThumb: {
    width: 220,
    height: 391,
    alignSelf: "center",
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    marginBottom: spacing.md,
  },
  previewPhoto: { ...StyleSheet.absoluteFillObject },
  previewOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 15, 30, 0.55)",
  },
  previewContent: { ...StyleSheet.absoluteFillObject, padding: spacing.md, justifyContent: "space-between" },
  previewBrand: { color: colors.primary, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  previewTitle: { color: "#fff", fontSize: 20, fontWeight: "800", marginTop: 40 },
  previewSubtitle: { color: "#fff", fontSize: 11, opacity: 0.85, marginTop: 4 },
  previewStats: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  previewStat: {
    width: 92,
    backgroundColor: "rgba(255, 255, 255, 0.10)",
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
  },
  previewStatValue: { color: colors.primary, fontSize: 16, fontWeight: "800" },
  previewStatLabel: { color: "#fff", fontSize: 8, opacity: 0.8, marginTop: 2 },
  statsChips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textSecondary, fontSize: 12 },
  chipTextActive: { color: "#fff", fontWeight: "600" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
