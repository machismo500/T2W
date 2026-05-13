import "react-native-gesture-handler";
import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Stack, Redirect, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/auth/AuthProvider";
import { colors } from "@/theme";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
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

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AuthGate>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: colors.bg },
                headerTintColor: colors.textPrimary,
                contentStyle: { backgroundColor: colors.bg },
              }}
            >
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="ride/[id]" options={{ title: "Ride" }} />
            </Stack>
          </AuthGate>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loader: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
});
