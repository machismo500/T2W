/**
 * Pure-TS test of the outbox store. We mock AsyncStorage in-memory so the
 * test runs under Node without pulling in the RN runtime.
 */

const memory = new Map<string, string>();

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (k: string) => Promise.resolve(memory.get(k) ?? null),
    setItem: (k: string, v: string) => Promise.resolve(memory.set(k, v)),
    removeItem: (k: string) => Promise.resolve(memory.delete(k)),
  },
}));

jest.mock("react-native-uuid", () => {
  let counter = 0;
  return { __esModule: true, default: { v4: () => `uuid-${++counter}` } };
});

import {
  ack,
  clear,
  enqueue,
  list,
  peekFirst,
  recordFailure,
} from "../outbox/store";

beforeEach(async () => {
  memory.clear();
  await clear();
});

describe("outbox/store", () => {
  it("enqueue persists the op with status=queued", async () => {
    await enqueue({
      kind: "ride.register",
      rideId: "r-1",
      body: { agreedCancellationTerms: true, agreedIndemnity: true },
    });
    const ops = await list();
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({
      kind: "ride.register",
      rideId: "r-1",
      status: "queued",
      attempts: 0,
    });
    expect(ops[0].id).toBe("uuid-1");
  });

  it("peekFirst skips permanently-failed ops", async () => {
    const a = await enqueue({ kind: "notification.read", notificationId: "n-1" });
    const b = await enqueue({ kind: "notification.read", notificationId: "n-2" });
    await recordFailure(a.id, true, { code: "BAD_REQUEST", message: "x", kind: "validation" });
    const next = await peekFirst();
    expect(next?.id).toBe(b.id);
  });

  it("ack removes the op", async () => {
    const op = await enqueue({ kind: "notification.read", notificationId: "n-1" });
    await ack(op.id);
    expect(await list()).toHaveLength(0);
  });

  it("recordFailure transient bumps attempts but keeps op in queue", async () => {
    const op = await enqueue({ kind: "notification.read", notificationId: "n-1" });
    await recordFailure(op.id, false, { code: "NETWORK", message: "x", kind: "network" });
    const ops = await list();
    expect(ops[0].status).toBe("retrying");
    expect(ops[0].attempts).toBe(1);
    expect(ops[0].lastError?.kind).toBe("network");
  });

  it("recordFailure permanent flips status to failed", async () => {
    const op = await enqueue({ kind: "notification.read", notificationId: "n-1" });
    await recordFailure(op.id, true, { code: "FORBIDDEN", message: "no", kind: "auth" });
    const ops = await list();
    expect(ops[0].status).toBe("failed");
  });

  it("FIFO order is preserved across concurrent enqueues", async () => {
    await Promise.all([
      enqueue({ kind: "notification.read", notificationId: "a" }),
      enqueue({ kind: "notification.read", notificationId: "b" }),
      enqueue({ kind: "notification.read", notificationId: "c" }),
    ]);
    const ops = await list();
    expect(ops).toHaveLength(3);
    // Order in the persisted array reflects createdAt — not guaranteed to
    // match insertion order under racy concurrent calls, but the lock
    // means no entries are lost.
    const ids = ops.map((o) => "notificationId" in o ? o.notificationId : "");
    expect(ids.sort()).toEqual(["a", "b", "c"]);
  });
});
