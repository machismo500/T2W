import { useEffect, useMemo, useState } from "react";
import { subscribe, list, dismissFailed } from "./store";
import { flushNow } from "./flusher";
import type { OutboxOp, OutboxOpInput } from "./types";
import { enqueue as storeEnqueue } from "./store";

/**
 * React surface over the outbox. Components don't talk to the store
 * directly — they use this hook.
 */
export function useOutbox() {
  const [ops, setOps] = useState<OutboxOp[]>([]);

  useEffect(() => {
    void list().then(setOps);
    return subscribe(setOps);
  }, []);

  return useMemo(
    () => ({
      ops,
      pendingCount: ops.filter((o) => o.status !== "failed").length,
      failedCount: ops.filter((o) => o.status === "failed").length,
      pendingForKind: (kind: OutboxOpInput["kind"]) =>
        ops.filter((o) => o.kind === kind && o.status !== "failed"),
      pendingForTarget: (predicate: (op: OutboxOp) => boolean) =>
        ops.filter((o) => predicate(o) && o.status !== "failed"),
      enqueue: async (input: OutboxOpInput) => {
        const op = await storeEnqueue(input);
        void flushNow();
        return op;
      },
      retryAll: () => flushNow(),
      dismiss: (id: string) => dismissFailed(id),
    }),
    [ops],
  );
}
