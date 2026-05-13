import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { fetchMe, login as loginApi, logout as logoutApi, register as registerApi, RegisterPayload } from "@/api/auth";
import { setOnUnauthenticated } from "@/api/client";
import { tokenStorage } from "@/api/storage";
import { installNotificationHandlers, registerForPushAsync, unregisterDevice } from "@/push";
import { setSentryUser } from "@/sentry";
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

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  const refreshMe = useCallback(async () => {
    try {
      const user = await fetchMe();
      setState({ status: "authed", user });
    } catch {
      setState({ status: "anon" });
    }
  }, []);

  useEffect(() => {
    setOnUnauthenticated(() => setState({ status: "anon" }));
    const detachPush = installNotificationHandlers();
    (async () => {
      const refreshToken = await tokenStorage.getRefreshToken();
      if (!refreshToken) {
        setState({ status: "anon" });
        return;
      }
      await refreshMe();
    })();
    return () => {
      detachPush();
    };
  }, [refreshMe]);

  // Whenever we transition to authed, register this device for push and
  // attach the user identity to Sentry. Fire-and-forget — failures are
  // logged but don't block the user.
  useEffect(() => {
    if (state.status === "authed") {
      void registerForPushAsync();
      setSentryUser({ id: state.user.id, email: state.user.email });
    }
    if (state.status === "anon") {
      setSentryUser(null);
    }
  }, [state]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      login: async (email, password) => {
        const user = await loginApi(email, password);
        setState({ status: "authed", user });
      },
      register: async (payload) => {
        const user = await registerApi(payload);
        setState({ status: "authed", user });
      },
      logout: async () => {
        await unregisterDevice();
        await logoutApi();
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
