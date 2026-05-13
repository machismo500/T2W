import AsyncStorage from "@react-native-async-storage/async-storage";
import uuid from "react-native-uuid";
import type { OutboxOp, OutboxOpInput } from "./types";

/**
 * AsyncStorage-backed FIFO outbox.
 *
 * We serialise the entire queue under one key — this is fine for the
 * expected scale (a few dozen ops max). A multi-rider party scenario
 * pushing hundreds of admin actions while offline would need expo-sqlite,
 * but that's not the target use case.
 *
 * Concurrency: every mutation reads the whole queue, modifies, writes
 * back. We serialize writes through a single in-flight promise so two
 * concurrent enqueues don't lose each other.
 */

const KEY = "t2w.outbox.v1";

let writeLock: Promise<void> = Promise.resolve();

async function readAll(): Promise<OutboxOp[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as OutboxOp[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(ops: OutboxOp[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(ops));
}

async function withLock<T>(fn: () => Promise<T>): Promise<T> {
  // Serialise via promise chain to avoid lost updates on rapid enqueues.
  let resolveOuter: () => void = () => {};
  const releaseLock = new Promise<void>((res) => {
    resolveOuter = res;
  });
  const prev = writeLock;
  writeLock = releaseLock;
  await prev;
  try {
    return await fn();
  } finally {
    resolveOuter();
  }
}

let subscribers: Array<(ops: OutboxOp[]) => void> = [];

function notify(ops: OutboxOp[]) {
  for (const fn of subscribers) {
    try {
      fn(ops);
    } catch (err) {
      console.warn("[T2W][outbox] subscriber threw:", err);
    }
  }
}

export function subscribe(fn: (ops: OutboxOp[]) => void): () => void {
  subscribers.push(fn);
  // Fire once with current state.
  void readAll().then(fn);
  return () => {
    subscribers = subscribers.filter((s) => s !== fn);
  };
}

export async function enqueue(input: OutboxOpInput): Promise<OutboxOp> {
  return withLock(async () => {
    const ops = await readAll();
    const op: OutboxOp = {
      ...input,
      id: String(uuid.v4()),
      createdAt: Date.now(),
      status: "queued",
      attempts: 0,
    };
    ops.push(op);
    await writeAll(ops);
    notify(ops);
    return op;
  });
}

export async function peekFirst(): Promise<OutboxOp | null> {
  const ops = await readAll();
  return ops.find((o) => o.status !== "failed") ?? null;
}

export async function list(): Promise<OutboxOp[]> {
  return readAll();
}

export async function ack(id: string): Promise<void> {
  await withLock(async () => {
    const ops = await readAll();
    const next = ops.filter((o) => o.id !== id);
    await writeAll(next);
    notify(next);
  });
}

export async function recordFailure(
  id: string,
  permanent: boolean,
  err: { code: string; message: string; kind: string },
): Promise<void> {
  await withLock(async () => {
    const ops = await readAll();
    const next = ops.map((o) =>
      o.id === id
        ? {
            ...o,
            status: permanent ? ("failed" as const) : ("retrying" as const),
            attempts: o.attempts + 1,
            lastError: err,
          }
        : o,
    );
    await writeAll(next);
    notify(next);
  });
}

export async function dismissFailed(id: string): Promise<void> {
  await ack(id);
}

export async function clear(): Promise<void> {
  await withLock(async () => {
    await AsyncStorage.removeItem(KEY);
    notify([]);
  });
}
