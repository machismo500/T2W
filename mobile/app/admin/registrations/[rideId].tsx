import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Screen } from "@/components/Screen";
import {
  listRideRegistrations,
  type AdminRegistration,
} from "@/api/admin";
import { useOutbox } from "@/outbox/useOutbox";
import { colors, radius, spacing, text } from "@/theme";

type Status = "pending" | "confirmed" | "rejected";

export default function RideRegistrationsScreen() {
  const { rideId } = useLocalSearchParams<{ rideId: string }>();
  void useQueryClient(); // hook order parity if we add direct mutations later
  const outbox = useOutbox();
  const [status, setStatus] = useState<Status>("pending");

  const q = useQuery({
    queryKey: ["admin", "registrations", rideId, status],
    queryFn: () => listRideRegistrations(rideId, status),
  });

  function moderateMutation(regId: string, approvalStatus: AdminRegistration["approvalStatus"]) {
    return outbox.enqueue({
      kind: "admin.registration.moderate",
      regId,
      body: { approvalStatus },
    });
  }

  function isModerating(regId: string): boolean {
    return outbox.pendingForTarget(
      (op) => op.kind === "admin.registration.moderate" && op.regId === regId,
    ).length > 0;
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: "Registrations" }} />
      <View style={styles.filters}>
        {(["pending", "confirmed", "rejected"] as Status[]).map((s) => (
          <Pressable
            key={s}
            onPress={() => setStatus(s)}
            style={[styles.chip, s === status && styles.chipActive]}
          >
            <Text style={[styles.chipText, s === status && styles.chipTextActive]}>{s}</Text>
          </Pressable>
        ))}
      </View>

      {q.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={q.data?.items ?? []}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <RegCard
              reg={item}
              busy={isModerating(item.id)}
              onApprove={() => moderateMutation(item.id, "confirmed")}
              onReject={() =>
                Alert.alert("Reject registration?", `${item.riderName}`, [
                  { text: "Cancel" },
                  {
                    text: "Reject",
                    style: "destructive",
                    onPress: () => moderateMutation(item.id, "rejected"),
                  },
                ])
              }
              onDropout={() =>
                Alert.alert("Mark as dropped out?", `${item.riderName}`, [
                  { text: "Cancel" },
                  {
                    text: "Drop out",
                    style: "destructive",
                    onPress: () => moderateMutation(item.id, "dropout"),
                  },
                ])
              }
              currentStatus={status}
            />
          )}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={text.bodySecondary}>No {status} registrations.</Text>
            </View>
          }
          refreshing={q.isRefetching}
          onRefresh={() => q.refetch()}
        />
      )}
    </Screen>
  );
}

function RegCard({
  reg,
  busy,
  onApprove,
  onReject,
  onDropout,
  currentStatus,
}: {
  reg: AdminRegistration;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
  onDropout: () => void;
  currentStatus: Status;
}) {
  return (
    <View style={styles.card}>
      <Text style={text.h3}>{reg.riderName}</Text>
      <Text style={text.caption}>{reg.email} · {reg.phone || "no phone"}</Text>
      <Text style={text.caption}>
        {reg.vehicleModel || "—"} ({reg.vehicleRegNumber || "—"}) · {reg.bloodGroup || "—"}
      </Text>
      <Text style={text.caption}>
        Emergency: {reg.emergencyContactName || "—"} · {reg.emergencyContactPhone || "—"}
      </Text>
      <Text style={text.caption}>
        {reg.accommodationType} · UTR: {reg.upiTransactionId || "—"} · code{" "}
        {reg.confirmationCode ?? "—"}
      </Text>

      {reg.paymentScreenshot ? (
        <Pressable onPress={() => Linking.openURL(reg.paymentScreenshot!)}>
          <Image source={{ uri: reg.paymentScreenshot }} style={styles.payment} />
        </Pressable>
      ) : null}

      {busy ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.sm }} />
      ) : (
        <View style={styles.actions}>
          {currentStatus === "pending" ? (
            <>
              <Pressable
                onPress={onApprove}
                style={[styles.actionBtn, { backgroundColor: colors.success }]}
              >
                <Text style={styles.actionText}>Approve</Text>
              </Pressable>
              <Pressable
                onPress={onReject}
                style={[styles.actionBtn, { backgroundColor: colors.danger }]}
              >
                <Text style={styles.actionText}>Reject</Text>
              </Pressable>
            </>
          ) : currentStatus === "confirmed" ? (
            <Pressable
              onPress={onDropout}
              style={[styles.actionBtn, { backgroundColor: colors.warning }]}
            >
              <Text style={styles.actionText}>Mark dropped out</Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  filters: {
    flexDirection: "row",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  chipTextActive: { color: "#fff" },
  list: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xl },
  card: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  payment: {
    width: "100%",
    height: 160,
    borderRadius: radius.md,
    marginTop: spacing.sm,
    backgroundColor: colors.card,
  },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  actionBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    alignItems: "center",
  },
  actionText: { color: "#fff", fontWeight: "600" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
});
