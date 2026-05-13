import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { colors } from "@/theme";

/**
 * Renders the 1080×1920 share card layout. The parent captures this with
 * react-native-view-shot and sends the PNG into the share sheet. Stats are
 * limited to 4 — matches the web's ShareableRideCard contract.
 */

export type ShareStat = { label: string; value: string };

export function ShareableRideCard({
  title,
  subtitle,
  photoUri,
  stats,
  riderName,
}: {
  title: string;
  subtitle: string;
  photoUri?: string | null;
  stats: ShareStat[];
  riderName: string;
}) {
  return (
    <View style={styles.card} collapsable={false}>
      {photoUri ? (
        <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />
      ) : (
        <View style={[styles.photo, styles.photoPh]} />
      )}
      <View style={styles.overlay} />

      <View style={styles.header}>
        <Text style={styles.brand}>TALES ON 2 WHEELS</Text>
        <Text style={styles.subhead}>{subtitle}</Text>
      </View>

      <View style={styles.titleWrap}>
        <Text style={styles.title} numberOfLines={3}>{title}</Text>
        <Text style={styles.rider}>by {riderName}</Text>
      </View>

      <View style={styles.statsGrid}>
        {stats.slice(0, 4).map((s) => (
          <View key={s.label} style={styles.statCell}>
            <Text style={styles.statValue}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>taleson2wheels.com</Text>
      </View>
    </View>
  );
}

// The view dimensions are fixed to a 1080×1920 logical size so view-shot
// captures pixel-accurate 9:16 PNGs. We scale down in the preview elsewhere.
export const SHARE_CARD_WIDTH = 1080;
export const SHARE_CARD_HEIGHT = 1920;

const styles = StyleSheet.create({
  card: {
    width: SHARE_CARD_WIDTH,
    height: SHARE_CARD_HEIGHT,
    backgroundColor: colors.bg,
    position: "relative",
    overflow: "hidden",
  },
  photo: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  photoPh: { backgroundColor: "#1a1a2e" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 15, 30, 0.55)",
  },
  header: { padding: 80, paddingBottom: 0 },
  brand: { color: colors.primary, fontSize: 42, fontWeight: "800", letterSpacing: 4 },
  subhead: { color: "#ffffff", fontSize: 28, marginTop: 16, opacity: 0.8 },
  titleWrap: { paddingHorizontal: 80, marginTop: 220 },
  title: { color: "#ffffff", fontSize: 96, fontWeight: "800", lineHeight: 108 },
  rider: { color: "#ffffff", fontSize: 36, marginTop: 32, opacity: 0.85 },
  statsGrid: {
    position: "absolute",
    bottom: 220,
    left: 80,
    right: 80,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 24,
  },
  statCell: {
    width: (SHARE_CARD_WIDTH - 80 * 2 - 24) / 2,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 32,
    padding: 40,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.18)",
  },
  statValue: { color: colors.primary, fontSize: 88, fontWeight: "800" },
  statLabel: { color: "#ffffff", fontSize: 30, marginTop: 16, opacity: 0.8, textTransform: "uppercase" },
  footer: {
    position: "absolute",
    bottom: 80,
    left: 80,
    right: 80,
    alignItems: "center",
  },
  footerText: { color: "#ffffff", fontSize: 28, opacity: 0.7, letterSpacing: 2 },
});
