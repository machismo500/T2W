import "react-native-gesture-handler";
import "@/live/background-task"; // registers the TaskManager task at startup
import { initSentry } from "@/sentry";
initSentry();
import React, { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Stack, Redirect, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { AuthProvider, useAuth } from "@/auth/AuthProvider";
import { OfflineBanner } from "@/components/OfflineBanner";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { startOutboxFlusher, stopOutboxFlusher } from "@/outbox/flusher";
import { colors } from "@/theme";

// Bump this when the cached shape of any query result changes — the
// persister keys cache buckets by this string and will discard anything
// hydrated under a different version.
const CACHE_BUSTER = "v1";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      // 30 s stale window keeps the UI cheap on focus while still showing
      // the cached payload instantly on cold-launch.
      staleTime: 30_000,
      // Persisted entries are valid for a week — keeps the leaderboard,
      // upcoming rides, etc. usable offline after a multi-day expedition.
      gcTime: 1000 * 60 * 60 * 24 * 7,
      // Render the cached payload immediately, then refetch silently. Avoids
      // the spinner-on-launch flicker for riders who relaunch the app in a
      // dead zone.
      refetchOnMount: "always",
    },
  },
});

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: `t2w.query-cache.${CACHE_BUSTER}`,
  throttleTime: 1000,
});

function AuthGate({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const segments = useSegments();
  const firstSegment = segments[0];
  const inAuthGroup = firstSegment === "(auth)";

  if (auth.status === "loading") {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (auth.status === "anon" && !inAuthGroup) {
    return <Redirect href="/(auth)/login" />;
  }
  if (auth.status === "authed" && inAuthGroup) {
    return <Redirect href="/(tabs)" />;
  }

  return <>{children}</>;
}

function OutboxStarter() {
  useEffect(() => {
    startOutboxFlusher(queryClient);
    return () => stopOutboxFlusher();
  }, []);
  return null;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister,
          maxAge: 1000 * 60 * 60 * 24 * 7,
          buster: CACHE_BUSTER,
          // Cache everything by default — privacy-sensitive data (payment
          // screenshots, raw participant lists) is admin-only and the bearer
          // token requirement is what gates access. Hiding it from disk on
          // sign-out is handled by AsyncStorage.removeItem in the auth
          // provider's logout path.
        }}
      >
        <AuthProvider>
          <OutboxStarter />
          <RouteErrorBoundary>
          <AuthGate>
            <StatusBar style="light" />
            <OfflineBanner />
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: colors.bg },
                headerTintColor: colors.textPrimary,
                contentStyle: { backgroundColor: colors.bg },
              }}
            >
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="ride/[id]/index" options={{ title: "Ride" }} />
              <Stack.Screen name="ride/[id]/live" options={{ title: "Live ride" }} />
              <Stack.Screen name="ride/[id]/register" options={{ title: "Register" }} />
              <Stack.Screen name="ride/[id]/share" options={{ title: "Share" }} />
              <Stack.Screen name="ride/[id]/posts" options={{ title: "Ride posts" }} />
              <Stack.Screen name="ride/[id]/summary" options={{ title: "Ride summary" }} />
              <Stack.Screen name="garage" options={{ title: "Garage" }} />
              <Stack.Screen name="guidelines" options={{ title: "Guidelines" }} />
              <Stack.Screen name="blogs" options={{ title: "Blogs" }} />
              <Stack.Screen name="blog/[id]" options={{ title: "Blog" }} />
              <Stack.Screen name="blog/new" options={{ title: "New blog" }} />
              <Stack.Screen name="contact" options={{ title: "Contact" }} />
              <Stack.Screen name="admin/users" options={{ title: "Users" }} />
              <Stack.Screen name="admin/registrations" options={{ title: "Registrations" }} />
              <Stack.Screen name="admin/registrations/[rideId]" options={{ title: "Registrations" }} />
              <Stack.Screen name="admin/activity-log" options={{ title: "Activity log" }} />
              <Stack.Screen name="admin/rides/new" options={{ title: "New ride" }} />
              <Stack.Screen name="admin/rides/[id]/edit" options={{ title: "Edit ride" }} />
              <Stack.Screen name="admin/settings" options={{ title: "Site settings" }} />
            </Stack>
          </AuthGate>
          </RouteErrorBoundary>
        </AuthProvider>
      </PersistQueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loader: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
});
