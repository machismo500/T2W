import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "@/theme";
import type { RideListItem } from "@/api/types";

function statusBadgeStyle(status: RideListItem["status"]) {
  switch (status) {
    case "upcoming":
      return { bg: "#1f3a5f", fg: "#7fb3ff" };
    case "ongoing":
      return { bg: "#1f4a3a", fg: "#7fd9a0" };
    case "completed":
      return { bg: "#2a2a4a", fg: "#a0a0b0" };
    case "cancelled":
      return { bg: "#4a1f1f", fg: "#ff8a8a" };
  }
}

export function RideCard({ ride, onPress }: { ride: RideListItem; onPress: () => void }) {
  const badge = statusBadgeStyle(ride.status);
  const start = new Date(ride.startDate);
  const dateLabel = start.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: start.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
    >
      {ride.posterUrl ? (
        <Image source={{ uri: ride.posterUrl }} style={styles.poster} />
      ) : (
        <View style={[styles.poster, styles.posterPlaceholder]}>
          <Text style={styles.posterPlaceholderText}>T2W</Text>
        </View>
      )}
      <View style={styles.body}>
        <View style={styles.row}>
          <Text style={styles.rideNumber}>#{ride.rideNumber}</Text>
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.badgeText, { color: badge.fg }]}>{ride.status}</Text>
          </View>
        </View>
        <Text style={styles.title} numberOfLines={2}>{ride.title}</Text>
        <Text style={styles.meta}>
          {dateLabel} · {ride.distanceKm} km · {ride.difficulty}
        </Text>
        <Text style={styles.meta}>
          {ride.startLocation} → {ride.endLocation}
        </Text>
        <View style={styles.footer}>
          <Text style={styles.count}>
            {ride.registeredRiders}/{ride.maxRiders} riders
          </Text>
          {ride.myRegistrationStatus ? (
            <View style={[styles.pill, pillStyle(ride.myRegistrationStatus)]}>
              <Text style={styles.pillText}>{ride.myRegistrationStatus}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

function pillStyle(status: NonNullable<RideListItem["myRegistrationStatus"]>) {
  if (status === "confirmed") return { backgroundColor: "#1f4a3a" };
  if (status === "pending") return { backgroundColor: "#4a3a1f" };
  return { backgroundColor: "#4a1f1f" };
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    overflow: "hidden",
  },
  poster: { width: "100%", height: 160, backgroundColor: colors.card },
  posterPlaceholder: { alignItems: "center", justifyContent: "center" },
  posterPlaceholderText: { color: colors.primary, fontSize: 32, fontWeight: "700" },
  body: { padding: spacing.md, gap: spacing.xs },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rideNumber: { color: colors.textSecondary, fontSize: 12, fontWeight: "600" },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill },
  badgeText: { fontSize: 11, fontWeight: "600", textTransform: "uppercase" },
  title: { color: colors.textPrimary, fontSize: 18, fontWeight: "700" },
  meta: { color: colors.textSecondary, fontSize: 13 },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.sm,
  },
  count: { color: colors.textSecondary, fontSize: 13 },
  pill: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill },
  pillText: { color: "#fff", fontSize: 11, textTransform: "uppercase", fontWeight: "600" },
});
