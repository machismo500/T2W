import NetInfo from "@react-native-community/netinfo";
import type { QueryClient } from "@tanstack/react-query";
import { ApiClientError } from "@/api/client";
import { ack, peekFirst, recordFailure, subscribe } from "./store";
import { dispatch, invalidationsFor } from "./handlers";
import type { OutboxOp } from "./types";

/**
 * Single-flight drain loop.
 *
 * Triggered by:
 *   - NetInfo flipping back to "connected" (the main signal)
 *   - A periodic 30 s tick while online (catches anything where the network
 *     event was missed — e.g. carrier-NAT changes that don't fire NetInfo)
 *   - An explicit `flushNow()` call after enqueue
 *
 * Strategy: pull the oldest non-failed op, dispatch it, ack on success,
 * mark retrying / failed on error. We process one at a time so a 4xx
 * surfaces immediately and we don't burn through the queue if the server
 * is rejecting everything.
 */

let flushing = false;
let lastBackoff = 0;
const MIN_BACKOFF_MS = 2_000;
const MAX_BACKOFF_MS = 60_000;

let queryClient: QueryClient | null = null;
let started = false;
let netUnsub: (() => void) | null = null;
let outboxUnsub: (() => void) | null = null;
let periodicTimer: ReturnType<typeof setInterval> | null = null;

export function startOutboxFlusher(qc: QueryClient) {
  if (started) return;
  started = true;
  queryClient = qc;

  netUnsub = NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable !== false) {
      void flushOnce();
    }
  });

  // Whenever an op gets enqueued, try to flush.
  outboxUnsub = subscribe(() => {
    void flushOnce();
  });

  periodicTimer = setInterval(() => {
    void flushOnce();
  }, 30_000);

  // Initial attempt on startup — covers the relaunch-after-airplane-mode case.
  void flushOnce();
}

export function stopOutboxFlusher() {
  netUnsub?.();
  outboxUnsub?.();
  if (periodicTimer) clearInterval(periodicTimer);
  started = false;
  queryClient = null;
  netUnsub = null;
  outboxUnsub = null;
  periodicTimer = null;
}

export async function flushNow(): Promise<void> {
  await flushOnce();
}

async function flushOnce(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    while (true) {
      const op = await peekFirst();
      if (!op) {
        lastBackoff = 0;
        return;
      }
      const handled = await tryOne(op);
      if (!handled) {
        // Either a network failure (back off and let the event loop / NetInfo
        // try again later) or a permanent failure that's already recorded.
        return;
      }
    }
  } finally {
    flushing = false;
  }
}

async function tryOne(op: OutboxOp): Promise<boolean> {
  try {
    await dispatch(op);
    await ack(op.id);
    if (queryClient) {
      for (const key of invalidationsFor(op)) {
        await queryClient.invalidateQueries({ queryKey: key });
      }
    }
    lastBackoff = 0;
    return true;
  } catch (err) {
    if (err instanceof ApiClientError) {
      if (err.isRetryable()) {
        await recordFailure(op.id, false, {
          code: err.code,
          message: err.message,
          kind: err.kind,
        });
        // Wait a bit before the next attempt. We don't sleep through the
        // entire backoff because the next NetInfo or enqueue event will
        // trigger another flushOnce — this just avoids hammering when the
        // server is mid-incident.
        lastBackoff = Math.min(
          MAX_BACKOFF_MS,
          lastBackoff === 0 ? MIN_BACKOFF_MS : lastBackoff * 2,
        );
        await new Promise((res) => setTimeout(res, lastBackoff));
        return false;
      }
      // 4xx — won't succeed on retry. Park the op as failed; the UI
      // surfaces it and the user dismisses or fixes.
      await recordFailure(op.id, true, {
        code: err.code,
        message: err.message,
        kind: err.kind,
      });
      return true; // continue with the next op
    }
    // Unknown error type — treat as retryable but record details so we
    // can debug from the Sentry trail.
    console.warn("[T2W][outbox] non-ApiClientError during flush:", err);
    await recordFailure(op.id, false, {
      code: "UNKNOWN",
      message: err instanceof Error ? err.message : String(err),
      kind: "unknown",
    });
    return false;
  }
}
