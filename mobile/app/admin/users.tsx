import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Screen } from "@/components/Screen";
import {
  changeUserRole,
  listAdminUsers,
  type AdminUser,
} from "@/api/admin";
import { useAuth } from "@/auth/AuthProvider";
import { useOutbox } from "@/outbox/useOutbox";
import { colors, radius, spacing, text } from "@/theme";

type Status = "pending" | "active";

export default function AdminUsersScreen() {
  const qc = useQueryClient();
  const auth = useAuth();
  const [status, setStatus] = useState<Status>("pending");

  const outbox = useOutbox();

  const q = useQuery({
    queryKey: ["admin", "users", status],
    queryFn: () => listAdminUsers({ status }),
  });

  // Role change is online-only — chained role updates have ordering effects
  // (e.g. promote then demote) that don't survive a flusher retry cleanly.
  // Approve / reject are queued via outbox so they survive offline.
  const roleMutation = useMutation({
    mutationFn: ({ id, newRole }: { id: string; newRole: string }) =>
      changeUserRole(id, newRole),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });

  const isSuper = auth.status === "authed" && auth.user.role === "superadmin";

  return (
    <Screen>
      <Stack.Screen options={{ title: "User approvals" }} />
      <View style={styles.filters}>
        {(["pending", "active"] as Status[]).map((s) => (
          <Pressable
            key={s}
            onPress={() => setStatus(s)}
            style={[styles.chip, s === status && styles.chipActive]}
          >
            <Text style={[styles.chipText, s === status && styles.chipTextActive]}>
              {s === "pending" ? "Pending" : "Active"}
            </Text>
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
          keyExtractor={(u) => u.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const pendingApprove = outbox.pendingForTarget(
              (op) => op.kind === "admin.user.approve" && op.userId === item.id,
            ).length > 0;
            const pendingReject = outbox.pendingForTarget(
              (op) => op.kind === "admin.user.reject" && op.userId === item.id,
            ).length > 0;
            return (
              <UserCard
                user={item}
                approving={pendingApprove}
                rejecting={pendingReject}
                onApprove={() => outbox.enqueue({ kind: "admin.user.approve", userId: item.id })}
                onReject={() =>
                  Alert.alert(
                    "Reject user?",
                    `${item.name} (${item.email}) will be deleted.`,
                    [
                      { text: "Cancel" },
                      {
                        text: "Reject",
                        style: "destructive",
                        onPress: () =>
                          outbox.enqueue({ kind: "admin.user.reject", userId: item.id }),
                      },
                    ],
                  )
                }
                onChangeRole={(newRole) => roleMutation.mutate({ id: item.id, newRole })}
                isSuper={isSuper}
                roleBusy={roleMutation.isPending && roleMutation.variables?.id === item.id}
              />
            );
          }}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={text.bodySecondary}>
                {status === "pending" ? "No pending users right now." : "No active users."}
              </Text>
            </View>
          }
          refreshing={q.isRefetching}
          onRefresh={() => q.refetch()}
        />
      )}
    </Screen>
  );
}

function UserCard({
  user,
  onApprove,
  onReject,
  onChangeRole,
  approving,
  rejecting,
  roleBusy,
  isSuper,
}: {
  user: AdminUser;
  onApprove: () => void;
  onReject: () => void;
  onChangeRole: (role: string) => void;
  approving: boolean;
  rejecting: boolean;
  roleBusy: boolean;
  isSuper: boolean;
}) {
  const roleOptions = isSuper
    ? ["rider", "t2w_rider", "core_member", "superadmin"]
    : ["rider", "t2w_rider"];

  return (
    <View style={styles.card}>
      <Text style={text.h3}>{user.name}</Text>
      <Text style={text.caption}>{user.email}</Text>
      {user.phone ? <Text style={text.caption}>{user.phone}</Text> : null}
      <Text style={text.caption}>
        Role: {user.role} · {user.isApproved ? "Approved" : "Pending"}
        {user.city ? ` · ${user.city}` : ""}
      </Text>

      {!user.isApproved ? (
        <View style={styles.actions}>
          <Pressable
            onPress={onApprove}
            disabled={approving}
            style={[styles.actionBtn, { backgroundColor: colors.success }]}
          >
            {approving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.actionText}>Approve</Text>
            )}
          </Pressable>
          <Pressable
            onPress={onReject}
            disabled={rejecting}
            style={[styles.actionBtn, { backgroundColor: colors.danger }]}
          >
            {rejecting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.actionText}>Reject</Text>
            )}
          </Pressable>
        </View>
      ) : (
        <View style={styles.actions}>
          {roleOptions
            .filter((r) => r !== user.role)
            .map((r) => (
              <Pressable
                key={r}
                onPress={() => onChangeRole(r)}
                disabled={roleBusy}
                style={[styles.actionBtn, { backgroundColor: colors.card }]}
              >
                <Text style={[styles.actionText, { color: colors.textPrimary }]}>
                  → {r.replace("_", " ")}
                </Text>
              </Pressable>
            ))}
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
  chipText: { color: colors.textSecondary, fontSize: 13, fontWeight: "600" },
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
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.sm },
  actionBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    minWidth: 90,
    alignItems: "center",
  },
  actionText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
});
