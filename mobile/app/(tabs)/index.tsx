import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Screen } from "@/components/Screen";
import { RideCard } from "@/components/RideCard";
import { listRides } from "@/api/rides";
import { apiFetch } from "@/api/client";
import { useAuth } from "@/auth/AuthProvider";
import { isTracking, resumeFlusherIfActive } from "@/live/tracker";
import { colors, radius, spacing, text } from "@/theme";
import type { NotificationItem } from "@/api/types";

function useUpcomingRides() {
  return useQuery({
    queryKey: ["rides", "upcoming", "home"],
    queryFn: () => listRides({ status: "upcoming", limit: 5 }),
  });
}

function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiFetch<{ notifications: NotificationItem[] }>("/api/v1/notifications"),
  });
}

export default function HomeScreen() {
  const auth = useAuth();
  const rides = useUpcomingRides();
  const notifs = useNotifications();
  const [activeRide, setActiveRide] = useState<string | null>(null);

  // If the OS still has the background-location task running (e.g. the app
  // was killed mid-ride), surface a banner so the rider can jump straight
  // back to the live screen. resumeFlusherIfActive() also relights our
  // in-process flush timer.
  useEffect(() => {
    (async () => {
      const status = await isTracking();
      if (status.active && status.rideId) {
        setActiveRide(status.rideId);
        await resumeFlusherIfActive();
      } else {
        setActiveRide(null);
      }
    })();
  }, []);

  const refreshing = rides.isFetching || notifs.isFetching;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            tintColor={colors.primary}
            refreshing={refreshing}
            onRefresh={() => {
              rides.refetch();
              notifs.refetch();
            }}
          />
        }
      >
        <Text style={text.h2}>
          {auth.status === "authed" ? `Welcome back, ${auth.user.name.split(" ")[0]}` : "Welcome"}
        </Text>

        {activeRide ? (
          <Pressable
            onPress={() => router.push(`/ride/${activeRide}/live`)}
            style={styles.resumeBanner}
          >
            <View style={styles.resumeDot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.resumeTitle}>Live ride is still tracking</Text>
              <Text style={styles.resumeBody}>
                Tap to open and stop tracking, or keep riding.
              </Text>
            </View>
          </Pressable>
        ) : null}

        {auth.status === "authed" && !auth.user.isApproved ? (
          <View style={styles.banner}>
            <Text style={styles.bannerTitle}>Account pending approval</Text>
            <Text style={styles.bannerBody}>
              Your account is awaiting Core Member approval. You can still browse rides
              while you wait.
            </Text>
          </View>
        ) : null}

        <Text style={[text.h3, styles.sectionTitle]}>Upcoming rides</Text>
        {rides.isLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : rides.data && rides.data.items.length > 0 ? (
          rides.data.items.map((r) => (
            <RideCard key={r.id} ride={r} onPress={() => router.push(`/ride/${r.id}`)} />
          ))
        ) : (
          <Text style={text.bodySecondary}>No upcoming rides right now.</Text>
        )}

        <Text style={[text.h3, styles.sectionTitle]}>Notifications</Text>
        {notifs.isLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : notifs.data && notifs.data.notifications.length > 0 ? (
          notifs.data.notifications.slice(0, 5).map((n) => (
            <View key={n.id} style={styles.notif}>
              <Text style={styles.notifTitle}>{n.title}</Text>
              <Text style={styles.notifBody}>{n.message}</Text>
            </View>
          ))
        ) : (
          <Text style={text.bodySecondary}>No notifications.</Text>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
  sectionTitle: { marginTop: spacing.md },
  banner: {
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    borderRadius: 12,
  },
  bannerTitle: { color: colors.warning, fontWeight: "700", marginBottom: spacing.xs },
  bannerBody: { color: colors.textSecondary },
  notif: {
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.sm,
  },
  notifTitle: { color: colors.textPrimary, fontWeight: "600", marginBottom: spacing.xs },
  notifBody: { color: colors.textSecondary, fontSize: 14 },
  resumeBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.bgElevated,
    borderColor: colors.success,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  resumeDot: { width: 10, height: 10, borderRadius: radius.pill, backgroundColor: colors.success },
  resumeTitle: { color: colors.success, fontWeight: "700" },
  resumeBody: { color: colors.textSecondary, fontSize: 13 },
});
