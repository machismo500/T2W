import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { Screen } from "@/components/Screen";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/Button";
import { deleteMotorcycle, listMotorcycles } from "@/api/misc";
import { useOutbox } from "@/outbox/useOutbox";
import { ApiClientError } from "@/api/client";
import { colors, radius, spacing, text } from "@/theme";

export default function GarageScreen() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["motorcycles"], queryFn: listMotorcycles });
  const [showAdd, setShowAdd] = useState(false);

  const removeMutation = useMutation({
    mutationFn: deleteMotorcycle,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["motorcycles"] }),
  });

  return (
    <Screen>
      <Stack.Screen options={{ title: "Garage" }} />
      {q.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={q.data?.motorcycles ?? []}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={styles.image} />
              ) : (
                <View style={[styles.image, styles.imagePh]}>
                  <Text style={{ color: colors.primary, fontSize: 28 }}>🏍️</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={text.h3}>{item.make} {item.model}</Text>
                {item.nickname ? <Text style={text.bodySecondary}>"{item.nickname}"</Text> : null}
                <Text style={text.caption}>
                  {item.year || "—"} · {item.cc ? `${item.cc}cc` : "—"} · {item.color || "—"}
                </Text>
              </View>
              <Pressable
                hitSlop={10}
                onPress={() =>
                  Alert.alert(
                    "Remove motorcycle?",
                    `${item.make} ${item.model}`,
                    [
                      { text: "Cancel" },
                      {
                        text: "Remove",
                        style: "destructive",
                        onPress: () => removeMutation.mutate(item.id),
                      },
                    ],
                  )
                }
              >
                <Text style={{ color: colors.danger }}>Remove</Text>
              </Pressable>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={text.bodySecondary}>No motorcycles yet.</Text>
            </View>
          }
          ListFooterComponent={
            <Button
              label="Add motorcycle"
              onPress={() => setShowAdd(true)}
              style={{ marginTop: spacing.lg }}
            />
          }
          refreshing={q.isRefetching}
          onRefresh={() => q.refetch()}
        />
      )}
      <AddMotorcycleModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onCreated={() => {
          setShowAdd(false);
          qc.invalidateQueries({ queryKey: ["motorcycles"] });
        }}
      />
    </Screen>
  );
}

function AddMotorcycleModal({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const outbox = useOutbox();
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [cc, setCC] = useState("");
  const [color, setColor] = useState("");
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!make.trim() || !model.trim()) {
      setError("Make and model are required.");
      return;
    }
    setBusy(true);
    try {
      await outbox.enqueue({
        kind: "motorcycle.create",
        body: {
          make: make.trim(),
          model: model.trim(),
          year: Number(year) || undefined,
          cc: Number(cc) || undefined,
          color: color.trim() || undefined,
          nickname: nickname.trim() || undefined,
        },
      });
      setMake(""); setModel(""); setCC(""); setColor(""); setNickname("");
      onCreated();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to add motorcycle.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, backgroundColor: colors.bg }}
      >
        <View style={{ padding: spacing.lg, gap: spacing.sm, flex: 1 }}>
          <Text style={text.h2}>Add motorcycle</Text>
          <TextField label="Make" value={make} onChangeText={setMake} autoCapitalize="words" />
          <TextField label="Model" value={model} onChangeText={setModel} autoCapitalize="words" />
          <TextField label="Year" value={year} onChangeText={setYear} keyboardType="number-pad" />
          <TextField label="CC" value={cc} onChangeText={setCC} keyboardType="number-pad" />
          <TextField label="Colour" value={color} onChangeText={setColor} />
          <TextField label="Nickname (optional)" value={nickname} onChangeText={setNickname} />
          {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
            <Button label="Cancel" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
            <Button label="Save" onPress={submit} loading={busy} style={{ flex: 1 }} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.sm },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  image: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.card },
  imagePh: { alignItems: "center", justifyContent: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
});
