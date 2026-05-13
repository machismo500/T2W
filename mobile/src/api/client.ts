import Constants from "expo-constants";
import { tokenStorage } from "./storage";
import type { ApiError, AuthTokens } from "./types";

const BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)?.apiBaseUrl ??
  "https://taleson2wheels.com";

type TokenState = { accessToken: string | null; expiresAt: number | null };
const tokens: TokenState = { accessToken: null, expiresAt: null };

let onUnauthenticated: (() => void) | null = null;
export function setOnUnauthenticated(handler: () => void) {
  onUnauthenticated = handler;
}

export function setAccessToken(token: string, expiresInSeconds: number) {
  tokens.accessToken = token;
  tokens.expiresAt = Date.now() + expiresInSeconds * 1000;
}

export function getAccessToken(): string | null {
  return tokens.accessToken;
}

export function clearTokensInMemory() {
  tokens.accessToken = null;
  tokens.expiresAt = null;
}

function isExpiringSoon(): boolean {
  if (!tokens.expiresAt) return true;
  // refresh 60 seconds before actual expiry
  return tokens.expiresAt - Date.now() < 60_000;
}

let inFlightRefresh: Promise<void> | null = null;

async function refreshAccessToken(): Promise<void> {
  if (inFlightRefresh) return inFlightRefresh;
  inFlightRefresh = (async () => {
    const refreshToken = await tokenStorage.getRefreshToken();
    if (!refreshToken) {
      clearTokensInMemory();
      onUnauthenticated?.();
      throw new ApiClientError("UNAUTHORIZED", "Not signed in");
    }

    const res = await fetch(`${BASE_URL}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      await tokenStorage.clear();
      clearTokensInMemory();
      onUnauthenticated?.();
      const body = (await res.json().catch(() => null)) as ApiError | null;
      throw new ApiClientError(
        body?.error.code ?? "INVALID_TOKEN",
        body?.error.message ?? "Session expired",
      );
    }

    const json = (await res.json()) as AuthTokens;
    setAccessToken(json.accessToken, json.accessTokenExpiresIn);
    await tokenStorage.setRefreshToken(json.refreshToken);
  })().finally(() => {
    inFlightRefresh = null;
  });
  return inFlightRefresh;
}

export class ApiClientError extends Error {
  code: string;
  status?: number;
  details?: Record<string, unknown>;
  constructor(code: string, message: string, status?: number, details?: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  // For login/register/refresh — skip the auth header and don't retry on 401.
  unauthenticated?: boolean;
  signal?: AbortSignal;
};

export async function apiFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }

  if (!opts.unauthenticated) {
    if (!tokens.accessToken || isExpiringSoon()) {
      try {
        await refreshAccessToken();
      } catch (err) {
        if (err instanceof ApiClientError) throw err;
        throw new ApiClientError("UNAUTHORIZED", "Authentication required");
      }
    }
  }

  const headers: Record<string, string> = {
    accept: "application/json",
  };
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  if (!opts.unauthenticated && tokens.accessToken) {
    headers.authorization = `Bearer ${tokens.accessToken}`;
  }

  const doFetch = () =>
    fetch(url.toString(), {
      method: opts.method ?? "GET",
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });

  let res = await doFetch();

  // One-shot retry on 401 — token may have expired mid-flight.
  if (res.status === 401 && !opts.unauthenticated) {
    try {
      await refreshAccessToken();
    } catch (err) {
      throw err instanceof ApiClientError
        ? err
        : new ApiClientError("UNAUTHORIZED", "Session expired");
    }
    headers.authorization = `Bearer ${tokens.accessToken}`;
    res = await doFetch();
  }

  if (!res.ok) {
    let body: ApiError | null = null;
    try {
      body = (await res.json()) as ApiError;
    } catch {
      // fallthrough
    }
    throw new ApiClientError(
      body?.error.code ?? "SERVER_ERROR",
      body?.error.message ?? `Request failed (${res.status})`,
      res.status,
      body?.error.details,
    );
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const apiBaseUrl = BASE_URL;
