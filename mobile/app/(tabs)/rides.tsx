import React, { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Screen } from "@/components/Screen";
import { RideCard } from "@/components/RideCard";
import { RideCardSkeleton } from "@/components/RideCardSkeleton";
import { listRides } from "@/api/rides";
import { colors, radius, spacing, text } from "@/theme";

type FilterStatus = "upcoming" | "ongoing" | "completed" | "all";
const FILTERS: { label: string; value: FilterStatus }[] = [
  { label: "Upcoming", value: "upcoming" },
  { label: "Live", value: "ongoing" },
  { label: "Past", value: "completed" },
  { label: "All", value: "all" },
];

export default function RidesScreen() {
  const [status, setStatus] = useState<FilterStatus>("upcoming");

  const query = useInfiniteQuery({
    queryKey: ["rides", status],
    queryFn: ({ pageParam }) =>
      listRides({ status, cursor: pageParam as string | undefined, limit: 20 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const items = query.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <Screen>
      <View style={styles.filters}>
        {FILTERS.map((f) => {
          const active = f.value === status;
          return (
            <Pressable
              key={f.value}
              onPress={() => setStatus(f.value)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {query.isLoading ? (
        <View style={styles.list}>
          <RideCardSkeleton />
          <RideCardSkeleton />
          <RideCardSkeleton />
        </View>
      ) : query.isError ? (
        <View style={styles.center}>
          <Text style={text.bodySecondary}>Couldn't load rides.</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <RideCard ride={item} onPress={() => router.push(`/ride/${item.id}`)} />
          )}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) {
              query.fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            query.isFetchingNextPage ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.md }} />
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={text.bodySecondary}>No rides in this view.</Text>
            </View>
          }
          refreshing={query.isRefetching}
          onRefresh={() => query.refetch()}
        />
      )}
    </Screen>
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
  list: { padding: spacing.md, paddingBottom: spacing.xl },
  center: { alignItems: "center", justifyContent: "center", padding: spacing.xl },
});
