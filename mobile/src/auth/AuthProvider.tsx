import React, { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQueryClient } from "@tanstack/react-query";
import { fetchMe, login as loginApi, logout as logoutApi, register as registerApi, RegisterPayload } from "@/api/auth";
import { ApiClientError, setOnUnauthenticated } from "@/api/client";
import { tokenStorage } from "@/api/storage";
import { installNotificationHandlers, registerForPushAsync, unregisterDevice } from "@/push";
import { setSentryUser } from "@/sentry";
import { prefetchEssentials } from "@/lib/prefetch";
import type { AuthUser } from "@/api/types";

type AuthState =
  | { status: "loading" }
  | { status: "authed"; user: AuthUser }
  | { status: "anon" };

type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
};

// Persisted alongside the refresh token so a cold-launch in airplane mode
// shows real user data instead of the loading spinner. We DO NOT persist
// the access token — it's short-lived and would just expire by the time
// it's read back.
const CACHED_USER_KEY = "t2w.cached-user.v1";

async function loadCachedUser(): Promise<AuthUser | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHED_USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

async function saveCachedUser(user: AuthUser | null) {
  if (user) {
    await AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(user));
  } else {
    await AsyncStorage.removeItem(CACHED_USER_KEY);
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });
  const queryClient = useQueryClient();
  // Track whether we've ever seen this session online — used to decide
  // whether a refresh-me network failure is "transient" (keep the cached
  // user) or "definitive" (flip to anon).
  const hasBeenOnlineRef = useRef(false);

  const refreshMe = useCallback(async () => {
    try {
      const user = await fetchMe();
      hasBeenOnlineRef.current = true;
      void saveCachedUser(user);
      setState({ status: "authed", user });
    } catch (err) {
      // Only flip to anon on a definitive auth rejection. Network errors
      // (no signal, DNS fail, server unreachable) keep the cached user so
      // the app remains usable offline.
      if (err instanceof ApiClientError && err.kind === "network") {
        const cached = await loadCachedUser();
        if (cached) {
          setState({ status: "authed", user: cached });
          return;
        }
      }
      void saveCachedUser(null);
      setState({ status: "anon" });
    }
  }, []);

  useEffect(() => {
    setOnUnauthenticated(() => {
      void saveCachedUser(null);
      setState({ status: "anon" });
    });
    const detachPush = installNotificationHandlers();
    (async () => {
      const refreshToken = await tokenStorage.getRefreshToken();
      if (!refreshToken) {
        setState({ status: "anon" });
        return;
      }
      // Show the cached user immediately so the UI doesn't flash through
      // the loader. refreshMe() will reconcile once the network is back.
      const cached = await loadCachedUser();
      if (cached) {
        setState({ status: "authed", user: cached });
      }
      await refreshMe();
    })();
    return () => {
      detachPush();
    };
  }, [refreshMe]);

  // Whenever we transition to authed: register this device for push,
  // attach the user identity to Sentry, and warm the query cache so the
  // next offline cold-launch shows real data. Fire-and-forget.
  useEffect(() => {
    if (state.status === "authed") {
      void registerForPushAsync();
      setSentryUser({ id: state.user.id, email: state.user.email });
      void prefetchEssentials(queryClient);
    }
    if (state.status === "anon") {
      setSentryUser(null);
    }
  }, [state, queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      login: async (email, password) => {
        const user = await loginApi(email, password);
        void saveCachedUser(user);
        setState({ status: "authed", user });
      },
      register: async (payload) => {
        const user = await registerApi(payload);
        void saveCachedUser(user);
        setState({ status: "authed", user });
      },
      logout: async () => {
        await unregisterDevice();
        await logoutApi();
        await saveCachedUser(null);
        setState({ status: "anon" });
      },
      refreshMe,
    }),
    [state, refreshMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
