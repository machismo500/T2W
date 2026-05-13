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

/**
 * A fetch failure (DNS, timeout, airplane mode) vs. an HTTP-level error
 * (4xx/5xx with a parseable body) is the difference between "we should
 * retry later from the outbox" and "this will never succeed, surface it
 * to the user." We model both with the same Error class but tag the
 * `kind` field so callers don't have to string-match on `message`.
 */
export type ApiClientErrorKind =
  | "network" // fetch threw — DNS / offline / TLS / timeout
  | "auth" // 401 / 403 / TOKEN_REUSED — re-login likely needed
  | "validation" // 400 / 409 / 422 — user input is bad, don't retry
  | "rate_limited" // 429
  | "server" // 5xx — server problem, retry is fine
  | "unknown";

export class ApiClientError extends Error {
  code: string;
  status?: number;
  details?: Record<string, unknown>;
  kind: ApiClientErrorKind;
  constructor(
    code: string,
    message: string,
    status?: number,
    details?: Record<string, unknown>,
    kind: ApiClientErrorKind = "unknown",
  ) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
    this.kind = kind;
  }

  isRetryable(): boolean {
    return this.kind === "network" || this.kind === "server" || this.kind === "rate_limited";
  }
}

function isFetchNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  // React Native fetch throws TypeError('Network request failed') on hard
  // network errors; web fetch throws on DNS / offline. We also treat
  // AbortError as network-ish for outbox retry purposes — a request the
  // caller cancelled isn't a permanent failure.
  if (err.name === "AbortError") return true;
  return /Network request failed|Failed to fetch|TypeError: Network/i.test(err.message);
}

function classifyStatus(status: number): ApiClientErrorKind {
  if (status === 401 || status === 403) return "auth";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "server";
  if (status >= 400) return "validation";
  return "unknown";
}

let inFlightRefresh: Promise<void> | null = null;

async function refreshAccessToken(): Promise<void> {
  if (inFlightRefresh) return inFlightRefresh;
  inFlightRefresh = (async () => {
    const refreshToken = await tokenStorage.getRefreshToken();
    if (!refreshToken) {
      clearTokensInMemory();
      onUnauthenticated?.();
      throw new ApiClientError("UNAUTHORIZED", "Not signed in", undefined, undefined, "auth");
    }

    let res: Response;
    try {
      res = await fetch(`${BASE_URL}/api/v1/auth/refresh`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
    } catch (err) {
      // Network error during refresh — keep the cached identity (the auth
      // provider will see this and stay authed) and let the caller retry
      // later. We do NOT call onUnauthenticated here.
      throw new ApiClientError(
        "NETWORK",
        "Couldn't reach the server to refresh your session",
        undefined,
        undefined,
        isFetchNetworkError(err) ? "network" : "unknown",
      );
    }

    if (!res.ok) {
      // Definitive auth rejection — token reused / expired / revoked.
      // Wipe local state and flip the app back to anon.
      await tokenStorage.clear();
      clearTokensInMemory();
      onUnauthenticated?.();
      const body = (await res.json().catch(() => null)) as ApiError | null;
      throw new ApiClientError(
        body?.error.code ?? "INVALID_TOKEN",
        body?.error.message ?? "Session expired",
        res.status,
        body?.error.details,
        "auth",
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
      await refreshAccessToken();
    }
  }

  const headers: Record<string, string> = {
    accept: "application/json",
  };
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  if (!opts.unauthenticated && tokens.accessToken) {
    headers.authorization = `Bearer ${tokens.accessToken}`;
  }

  const doFetch = async () => {
    try {
      return await fetch(url.toString(), {
        method: opts.method ?? "GET",
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: opts.signal,
      });
    } catch (err) {
      throw new ApiClientError(
        "NETWORK",
        "No connection",
        undefined,
        undefined,
        isFetchNetworkError(err) ? "network" : "unknown",
      );
    }
  };

  let res = await doFetch();

  // One-shot retry on 401 — token may have expired mid-flight.
  if (res.status === 401 && !opts.unauthenticated) {
    await refreshAccessToken();
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
      classifyStatus(res.status),
    );
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const apiBaseUrl = BASE_URL;
