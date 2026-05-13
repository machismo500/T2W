import React from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import Constants from "expo-constants";
import { ChevronRight } from "lucide-react-native";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/Button";
import { useAuth } from "@/auth/AuthProvider";
import { colors, radius, spacing, text } from "@/theme";

function getBuildVariant(): string {
  const extra = (Constants.expoConfig?.extra as { buildVariant?: string } | undefined) ?? {};
  return extra.buildVariant ?? "production";
}

export default function ProfileScreen() {
  const auth = useAuth();
  if (auth.status !== "authed") return null;
  const u = auth.user;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          {u.avatar ? (
            <Image source={{ uri: u.avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitial}>{u.name[0]?.toUpperCase() ?? "?"}</Text>
            </View>
          )}
          <Text style={[text.h2, { marginTop: spacing.md }]}>{u.name}</Text>
          <Text style={text.bodySecondary}>{u.email}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{u.role.replace("_", " ")}</Text>
          </View>
          {getBuildVariant() !== "production" ? (
            <View style={styles.variantBadge}>
              <Text style={styles.variantText}>{getBuildVariant()}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.statsRow}>
          <Stat label="Total km" value={u.totalKm.toFixed(0)} />
          <Stat label="Rides done" value={String(u.ridesCompleted)} />
        </View>

        <View style={styles.section}>
          <Row label="Phone" value={u.phone ?? "—"} />
          <Row label="City" value={u.city ?? "—"} />
          <Row label="Experience" value={u.ridingExperience ?? "—"} />
          <Row label="Joined" value={new Date(u.joinDate).toLocaleDateString()} />
          <Row
            label="Status"
            value={u.isApproved ? "Approved" : "Pending approval"}
          />
        </View>

        <View style={styles.section}>
          <LinkRow label="My garage" onPress={() => router.push("/garage")} />
          <LinkRow label="Riding guidelines" onPress={() => router.push("/guidelines")} />
          <LinkRow label="Blogs" onPress={() => router.push("/blogs")} />
          <LinkRow label="Contact crew" onPress={() => router.push("/contact")} />
        </View>

        <Button label="Sign out" variant="secondary" onPress={() => auth.logout()} />
      </ScrollView>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function LinkRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
    >
      <Text style={styles.rowValue}>{label}</Text>
      <ChevronRight color={colors.textSecondary} size={18} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl },
  header: { alignItems: "center" },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.card },
  avatarPlaceholder: { alignItems: "center", justifyContent: "center" },
  avatarInitial: { color: colors.primary, fontSize: 36, fontWeight: "700" },
  roleBadge: {
    marginTop: spacing.sm,
    backgroundColor: colors.bgElevated,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  roleText: { color: colors.primary, fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  variantBadge: {
    marginTop: spacing.xs,
    backgroundColor: colors.warning,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  variantText: { color: "#1a1a2e", fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1 },
  statsRow: { flexDirection: "row", gap: spacing.md },
  stat: {
    flex: 1,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: "center",
  },
  statValue: { color: colors.primary, fontSize: 26, fontWeight: "700" },
  statLabel: { color: colors.textSecondary, fontSize: 12, marginTop: spacing.xs },
  section: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLabel: { color: colors.textSecondary, fontSize: 14 },
  rowValue: { color: colors.textPrimary, fontSize: 14, fontWeight: "500" },
});
