/**
 * Tests for src/lib/location-queue.ts
 *
 * We stub `window.indexedDB` with a minimal in-memory implementation so the
 * module's real logic runs without a browser.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { QueuedLocation } from '@/lib/location-queue';

// ── Fake IndexedDB ──────────────────────────────────────────────────────────

const _db = new Map<number, any>();
let _nextId = 1;

function resetDB() {
  _db.clear();
  _nextId = 1;
}

/** Create an IDB-style request that delivers its result in the next microtask. */
function fakeRequest<T>(value: T) {
  const req: any = {
    result: value,
    error: null,
    set onsuccess(fn: (e: any) => void) {
      Promise.resolve().then(() => fn({ target: req }));
    },
    set onerror(_fn: any) {},
  };
  return req;
}

/** Create a fake IDB transaction. Operations are buffered and executed when
 *  `oncomplete` is set (in the next microtask), mirroring real IDB behaviour. */
function fakeTx() {
  const ops: Array<() => void> = [];

  const storeProxy = {
    add(item: any) {
      ops.push(() => {
        const id = _nextId++;
        _db.set(id, { ...item, id });
      });
      return fakeRequest(undefined);
    },
    delete(id: number) {
      ops.push(() => _db.delete(id));
      return fakeRequest(undefined);
    },
    index(_name: string) {
      return {
        /** Snapshot current db state eagerly — same semantics as real IDB. */
        getAll(key: string) {
          const results = Array.from(_db.values()).filter((v) => v.rideId === key);
          return fakeRequest(results);
        },
      };
    },
    getAll() {
      return fakeRequest(Array.from(_db.values()));
    },
  };

  const tx: any = {
    objectStore: () => storeProxy,
    error: null,
    set oncomplete(fn: () => void) {
      Promise.resolve().then(() => {
        ops.forEach((op) => op());
        fn();
      });
    },
    set onerror(_fn: any) {},
  };
  return tx;
}

const fakeIDB = {
  open: () => {
    const req: any = {
      result: {
        objectStoreNames: { contains: () => true },
        createObjectStore: () => ({ createIndex: () => {} }),
        transaction: () => fakeTx(),
      },
      error: null,
      set onupgradeneeded(_fn: any) {},
      set onsuccess(fn: () => void) {
        Promise.resolve().then(() => fn());
      },
      set onerror(_fn: any) {},
    };
    return req;
  },
};

// ── Test setup ──────────────────────────────────────────────────────────────

beforeEach(() => {
  resetDB();
  vi.stubGlobal('indexedDB', fakeIDB);
});

// Re-import after stubbing so the module uses the fake IDB.
// vitest re-evaluates modules per suite when using vi.stubGlobal, but since
// location-queue.ts captures `indexedDB` lazily (calls it inside functions),
// importing at the top of the file is fine.
import {
  enqueueLocation,
  getPendingLocations,
  removeLocations,
  getPendingCount,
  flushLocationQueue,
} from '@/lib/location-queue';

// ── enqueueLocation ─────────────────────────────────────────────────────────

describe('enqueueLocation', () => {
  it('stores a location in the queue', async () => {
    await enqueueLocation({ rideId: 'ride-1', lat: 12.97, lng: 77.59, timestamp: 1000 });

    expect(_db.size).toBe(1);
    const stored = Array.from(_db.values())[0];
    expect(stored.rideId).toBe('ride-1');
    expect(stored.lat).toBe(12.97);
    expect(stored.id).toBeDefined();
  });

  it('assigns auto-incrementing IDs', async () => {
    await enqueueLocation({ rideId: 'ride-1', lat: 12.97, lng: 77.59, timestamp: 1000 });
    await enqueueLocation({ rideId: 'ride-1', lat: 12.98, lng: 77.60, timestamp: 2000 });

    const ids = Array.from(_db.keys());
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe(ids[1]);
  });

  it('stores optional speed, heading, accuracy fields', async () => {
    await enqueueLocation({
      rideId: 'ride-1',
      lat: 12.97,
      lng: 77.59,
      speed: 60,
      heading: 180,
      accuracy: 10,
      timestamp: 1000,
    });

    const stored = Array.from(_db.values())[0];
    expect(stored.speed).toBe(60);
    expect(stored.heading).toBe(180);
    expect(stored.accuracy).toBe(10);
  });
});

// ── getPendingLocations ─────────────────────────────────────────────────────

describe('getPendingLocations', () => {
  it('returns empty array when no pings queued', async () => {
    const result = await getPendingLocations('ride-1');
    expect(result).toEqual([]);
  });

  it('returns only pings for the specified rideId', async () => {
    await enqueueLocation({ rideId: 'ride-1', lat: 12.97, lng: 77.59, timestamp: 1000 });
    await enqueueLocation({ rideId: 'ride-2', lat: 13.00, lng: 77.60, timestamp: 2000 });
    await enqueueLocation({ rideId: 'ride-1', lat: 12.98, lng: 77.61, timestamp: 3000 });

    const result = await getPendingLocations('ride-1');
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.rideId === 'ride-1')).toBe(true);
  });

  it('returns pings sorted by timestamp ascending (oldest first)', async () => {
    await enqueueLocation({ rideId: 'ride-1', lat: 12.97, lng: 77.59, timestamp: 3000 });
    await enqueueLocation({ rideId: 'ride-1', lat: 12.98, lng: 77.60, timestamp: 1000 });
    await enqueueLocation({ rideId: 'ride-1', lat: 12.99, lng: 77.61, timestamp: 2000 });

    const result = await getPendingLocations('ride-1');
    expect(result[0].timestamp).toBe(1000);
    expect(result[1].timestamp).toBe(2000);
    expect(result[2].timestamp).toBe(3000);
  });
});

// ── removeLocations ─────────────────────────────────────────────────────────

describe('removeLocations', () => {
  it('is a no-op for empty id list', async () => {
    await enqueueLocation({ rideId: 'ride-1', lat: 12.97, lng: 77.59, timestamp: 1000 });
    await removeLocations([]);
    expect(_db.size).toBe(1);
  });

  it('removes specified pings by id', async () => {
    await enqueueLocation({ rideId: 'ride-1', lat: 12.97, lng: 77.59, timestamp: 1000 });
    await enqueueLocation({ rideId: 'ride-1', lat: 12.98, lng: 77.60, timestamp: 2000 });

    const pending = await getPendingLocations('ride-1');
    const idsToRemove = [pending[0].id!];
    await removeLocations(idsToRemove);

    expect(_db.size).toBe(1);
    expect(Array.from(_db.values())[0].timestamp).toBe(2000);
  });

  it('can remove multiple pings at once', async () => {
    await enqueueLocation({ rideId: 'ride-1', lat: 12.97, lng: 77.59, timestamp: 1000 });
    await enqueueLocation({ rideId: 'ride-1', lat: 12.98, lng: 77.60, timestamp: 2000 });
    await enqueueLocation({ rideId: 'ride-1', lat: 12.99, lng: 77.61, timestamp: 3000 });

    const pending = await getPendingLocations('ride-1');
    await removeLocations(pending.map((p) => p.id!));

    expect(_db.size).toBe(0);
  });
});

// ── getPendingCount ─────────────────────────────────────────────────────────

describe('getPendingCount', () => {
  it('returns 0 when nothing queued', async () => {
    expect(await getPendingCount('ride-1')).toBe(0);
  });

  it('returns correct count for a ride', async () => {
    await enqueueLocation({ rideId: 'ride-1', lat: 12.97, lng: 77.59, timestamp: 1000 });
    await enqueueLocation({ rideId: 'ride-1', lat: 12.98, lng: 77.60, timestamp: 2000 });
    await enqueueLocation({ rideId: 'ride-2', lat: 13.00, lng: 77.70, timestamp: 3000 });

    expect(await getPendingCount('ride-1')).toBe(2);
    expect(await getPendingCount('ride-2')).toBe(1);
  });
});

// ── flushLocationQueue ──────────────────────────────────────────────────────

describe('flushLocationQueue', () => {
  it('returns 0 and calls submitFn 0 times when queue is empty', async () => {
    const submitFn = vi.fn().mockResolvedValue(undefined);
    const flushed = await flushLocationQueue('ride-1', submitFn);
    expect(flushed).toBe(0);
    expect(submitFn).not.toHaveBeenCalled();
  });

  it('calls submitFn for each queued ping in timestamp order', async () => {
    await enqueueLocation({ rideId: 'ride-1', lat: 12.98, lng: 77.60, timestamp: 2000 });
    await enqueueLocation({ rideId: 'ride-1', lat: 12.97, lng: 77.59, timestamp: 1000 });

    const submitFn = vi.fn().mockResolvedValue(undefined);
    await flushLocationQueue('ride-1', submitFn);

    expect(submitFn).toHaveBeenCalledTimes(2);
    // First call should be the older ping (timestamp 1000)
    expect(submitFn.mock.calls[0][0].lat).toBe(12.97);
    expect(submitFn.mock.calls[1][0].lat).toBe(12.98);
  });

  it('removes all pings and returns count after successful flush', async () => {
    await enqueueLocation({ rideId: 'ride-1', lat: 12.97, lng: 77.59, timestamp: 1000 });
    await enqueueLocation({ rideId: 'ride-1', lat: 12.98, lng: 77.60, timestamp: 2000 });
    await enqueueLocation({ rideId: 'ride-1', lat: 12.99, lng: 77.61, timestamp: 3000 });

    const submitFn = vi.fn().mockResolvedValue(undefined);
    const flushed = await flushLocationQueue('ride-1', submitFn);

    expect(flushed).toBe(3);
    expect(await getPendingCount('ride-1')).toBe(0);
  });

  it('stops on first submit failure and keeps remaining pings in queue', async () => {
    await enqueueLocation({ rideId: 'ride-1', lat: 12.97, lng: 77.59, timestamp: 1000 });
    await enqueueLocation({ rideId: 'ride-1', lat: 12.98, lng: 77.60, timestamp: 2000 });
    await enqueueLocation({ rideId: 'ride-1', lat: 12.99, lng: 77.61, timestamp: 3000 });

    const submitFn = vi.fn().mockRejectedValue(new Error('Network offline'));
    const flushed = await flushLocationQueue('ride-1', submitFn);

    expect(flushed).toBe(0);
    expect(submitFn).toHaveBeenCalledTimes(1); // tried once, stopped
    expect(await getPendingCount('ride-1')).toBe(3); // all still queued
  });

  it('removes successfully sent pings and keeps unsent ones when failure occurs mid-flush', async () => {
    await enqueueLocation({ rideId: 'ride-1', lat: 12.97, lng: 77.59, timestamp: 1000 });
    await enqueueLocation({ rideId: 'ride-1', lat: 12.98, lng: 77.60, timestamp: 2000 });
    await enqueueLocation({ rideId: 'ride-1', lat: 12.99, lng: 77.61, timestamp: 3000 });

    // First 2 succeed, third fails
    const submitFn = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Network offline'));

    const flushed = await flushLocationQueue('ride-1', submitFn);

    expect(flushed).toBe(2);
    expect(await getPendingCount('ride-1')).toBe(1); // one still queued
    const remaining = await getPendingLocations('ride-1');
    expect(remaining[0].timestamp).toBe(3000);
  });

  it('passes correct location fields to submitFn', async () => {
    await enqueueLocation({
      rideId: 'ride-1',
      lat: 12.97,
      lng: 77.59,
      speed: 55,
      heading: 90,
      accuracy: 8,
      timestamp: 1000,
    });

    const submitFn = vi.fn().mockResolvedValue(undefined);
    await flushLocationQueue('ride-1', submitFn);

    expect(submitFn).toHaveBeenCalledWith(
      expect.objectContaining({ lat: 12.97, lng: 77.59, speed: 55, heading: 90, accuracy: 8 })
    );
    // timestamp and rideId should NOT be passed to submitFn
    expect(submitFn.mock.calls[0][0]).not.toHaveProperty('timestamp');
    expect(submitFn.mock.calls[0][0]).not.toHaveProperty('rideId');
  });

  it('only flushes pings for the specified rideId', async () => {
    await enqueueLocation({ rideId: 'ride-1', lat: 12.97, lng: 77.59, timestamp: 1000 });
    await enqueueLocation({ rideId: 'ride-2', lat: 13.00, lng: 77.70, timestamp: 2000 });

    const submitFn = vi.fn().mockResolvedValue(undefined);
    const flushed = await flushLocationQueue('ride-1', submitFn);

    expect(flushed).toBe(1);
    expect(submitFn).toHaveBeenCalledTimes(1);
    // ride-2's ping should still be in the queue
    expect(await getPendingCount('ride-2')).toBe(1);
  });
});
