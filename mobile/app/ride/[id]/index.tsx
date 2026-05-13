import React from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, Stack, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/Button";
import { getRide } from "@/api/rides";
import { colors, radius, spacing, text } from "@/theme";

export default function RideDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useQuery({
    queryKey: ["ride", id],
    queryFn: () => getRide(id),
    enabled: typeof id === "string",
  });

  if (query.isLoading || !query.data) {
    return (
      <Screen>
        <View style={styles.center}>
          {query.isError ? (
            <Text style={text.bodySecondary}>Couldn't load this ride.</Text>
          ) : (
            <ActivityIndicator color={colors.primary} />
          )}
        </View>
      </Screen>
    );
  }

  const ride = query.data;
  const start = new Date(ride.startDate);
  const end = new Date(ride.endDate);

  return (
    <Screen edges={["left", "right"]}>
      <Stack.Screen options={{ title: `#${ride.rideNumber}` }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        {ride.posterUrl ? (
          <Image source={{ uri: ride.posterUrl }} style={styles.poster} />
        ) : null}

        <View style={styles.padding}>
          <Text style={text.h1}>{ride.title}</Text>
          <Text style={[text.bodySecondary, { marginTop: spacing.xs }]}>
            #{ride.rideNumber} · {ride.difficulty} · {ride.distanceKm} km
          </Text>

          <View style={styles.metaRow}>
            <Meta label="From" value={ride.startLocation} url={ride.startLocationUrl} />
            <Meta label="To" value={ride.endLocation} url={ride.endLocationUrl} />
          </View>

          <View style={styles.metaRow}>
            <Meta label="Starts" value={start.toLocaleString()} />
            <Meta label="Ends" value={end.toLocaleString()} />
          </View>

          {ride.description ? (
            <>
              <Text style={[text.h3, styles.section]}>About this ride</Text>
              <Text style={text.body}>{ride.description}</Text>
            </>
          ) : null}

          {ride.highlights.length > 0 ? (
            <>
              <Text style={[text.h3, styles.section]}>Highlights</Text>
              {ride.highlights.map((h, i) => (
                <Text key={i} style={styles.bullet}>· {h}</Text>
              ))}
            </>
          ) : null}

          <Text style={[text.h3, styles.section]}>Crew</Text>
          <Row label="Lead" value={ride.leadRider ?? "—"} />
          <Row label="Sweep" value={ride.sweepRider ?? "—"} />
          <Row label="Organised by" value={ride.organisedBy ?? "—"} />
          <Row label="Accounts" value={ride.accountsBy ?? "—"} />
          <Row label="Fee" value={`₹${ride.fee}`} />

          <Text style={[text.h3, styles.section]}>
            Confirmed riders ({ride.confirmedRiders.length}/{ride.maxRiders})
          </Text>
          {ride.confirmedRiders.length === 0 ? (
            <Text style={text.bodySecondary}>No confirmations yet.</Text>
          ) : (
            ride.confirmedRiders.map((r, i) => (
              <Text key={i} style={styles.rider}>
                · {r.name} ({r.accommodationType})
              </Text>
            ))
          )}

          {ride.myRegistration ? (
            <View style={[styles.regBox, styles.section]}>
              <Text style={styles.regTitle}>You're registered</Text>
              <Text style={text.bodySecondary}>
                Status: {ride.myRegistration.approvalStatus}
              </Text>
              {ride.myRegistration.confirmationCode ? (
                <Text style={text.bodySecondary}>
                  Code: {ride.myRegistration.confirmationCode}
                </Text>
              ) : null}
            </View>
          ) : ride.status === "upcoming" ? (
            <Button
              label="Register for this ride"
              onPress={() => router.push(`/ride/${ride.id}/register`)}
              style={{ marginTop: spacing.lg }}
            />
          ) : null}

          {ride.status === "ongoing" || ride.status === "upcoming" ? (
            <Button
              label="Open live ride"
              variant="secondary"
              onPress={() => router.push(`/ride/${ride.id}/live`)}
              style={{ marginTop: spacing.md }}
            />
          ) : null}

          {ride.status === "completed" || ride.status === "ongoing" ? (
            <Button
              label="Share your ride"
              variant="secondary"
              onPress={() => router.push(`/ride/${ride.id}/share`)}
              style={{ marginTop: spacing.md }}
            />
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

function Meta({ label, value, url }: { label: string; value: string; url?: string | null }) {
  const inner = (
    <View style={styles.meta}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={[text.body, url ? { color: colors.primary } : null]}>{value}</Text>
    </View>
  );
  if (url) {
    return (
      <Pressable onPress={() => Linking.openURL(url)} style={{ flex: 1 }}>
        {inner}
      </Pressable>
    );
  }
  return inner;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xl },
  poster: { width: "100%", height: 240, backgroundColor: colors.card },
  padding: { padding: spacing.lg, gap: spacing.xs },
  metaRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.md },
  meta: { flex: 1 },
  metaLabel: { color: colors.textSecondary, fontSize: 12, marginBottom: 2 },
  section: { marginTop: spacing.lg, marginBottom: spacing.sm },
  bullet: { color: colors.textPrimary, fontSize: 15, marginVertical: 2 },
  rider: { color: colors.textPrimary, fontSize: 14, marginVertical: 2 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.xs },
  rowLabel: { color: colors.textSecondary, fontSize: 14 },
  rowValue: { color: colors.textPrimary, fontSize: 14, fontWeight: "500" },
  regBox: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  regTitle: { color: colors.success, fontWeight: "700", marginBottom: spacing.xs },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
