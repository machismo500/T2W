import { Platform } from "react-native";
import uuid from "react-native-uuid";
import { apiFetch, setAccessToken, clearTokensInMemory } from "./client";
import { deviceStorage, tokenStorage } from "./storage";
import type { AuthTokens, AuthUser, LoginResponse } from "./types";

async function ensureDeviceId(): Promise<string> {
  let id = await deviceStorage.getDeviceId();
  if (!id) {
    id = String(uuid.v4());
    await deviceStorage.setDeviceId(id);
  }
  return id;
}

function devicePayload() {
  return {
    deviceId: undefined as string | undefined,
    platform: (Platform.OS === "ios" ? "ios" : "android") as "ios" | "android",
  };
}

async function persistTokens(tokens: AuthTokens) {
  setAccessToken(tokens.accessToken, tokens.accessTokenExpiresIn);
  await tokenStorage.setRefreshToken(tokens.refreshToken);
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const deviceId = await ensureDeviceId();
  const res = await apiFetch<LoginResponse>("/api/v1/auth/login", {
    method: "POST",
    body: { email, password, deviceId, platform: devicePayload().platform },
    unauthenticated: true,
  });
  await persistTokens(res);
  return res.user;
}

export type RegisterPayload = {
  email: string;
  name: string;
  password: string;
  phone?: string;
  city?: string;
  ridingExperience?: string;
  motorcycle?: string;
};

export async function register(payload: RegisterPayload): Promise<AuthUser> {
  const deviceId = await ensureDeviceId();
  const res = await apiFetch<LoginResponse>("/api/v1/auth/register", {
    method: "POST",
    body: { ...payload, deviceId, platform: devicePayload().platform },
    unauthenticated: true,
  });
  await persistTokens(res);
  return res.user;
}

export async function fetchMe(): Promise<AuthUser> {
  const res = await apiFetch<{ user: AuthUser }>("/api/v1/auth/me");
  return res.user;
}

export async function sendOtp(email: string) {
  await apiFetch<{ success: true }>("/api/v1/auth/send-otp", {
    method: "POST",
    body: { email },
    unauthenticated: true,
  });
}

export async function verifyOtp(email: string, code: string) {
  await apiFetch<{ success: true }>("/api/v1/auth/verify-otp", {
    method: "POST",
    body: { email, code },
    unauthenticated: true,
  });
}

export async function sendResetOtp(email: string) {
  await apiFetch<{ success: true }>("/api/v1/auth/send-reset-otp", {
    method: "POST",
    body: { email },
    unauthenticated: true,
  });
}

export async function verifyResetOtp(email: string, code: string) {
  await apiFetch<{ success: true }>("/api/v1/auth/verify-reset-otp", {
    method: "POST",
    body: { email, code },
    unauthenticated: true,
  });
}

export async function resetPassword(email: string, newPassword: string) {
  await apiFetch<{ success: true }>("/api/v1/auth/reset-password", {
    method: "POST",
    body: { email, newPassword },
    unauthenticated: true,
  });
}

export async function logout(opts: { allDevices?: boolean } = {}) {
  const refreshToken = await tokenStorage.getRefreshToken();
  try {
    await apiFetch<{ success: true }>("/api/v1/auth/logout", {
      method: "POST",
      body: { refreshToken, allDevices: opts.allDevices ?? false },
    });
  } catch {
    // Best-effort — even if the server call fails, clear the local session.
  }
  clearTokensInMemory();
  await tokenStorage.clear();
}
