/**
 * IndexedDB-based offline queue for GPS location pings.
 * When network is unavailable, pings are stored here and flushed on reconnect
 * — either via the `online` event in the page, or via Background Sync in the
 * service worker (Chrome/Android).
 */

const DB_NAME = "t2w-tracking";
const STORE = "pending-locations";
const DB_VERSION = 1;

export interface QueuedLocation {
  id?: number;
  rideId: string;
  lat: number;
  lng: number;
  speed?: number | null;
  heading?: number | null;
  accuracy?: number | null;
  timestamp: number; // unix ms — used to replay in chronological order
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("rideId", "rideId");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Add one location ping to the offline queue. */
export async function enqueueLocation(
  loc: Omit<QueuedLocation, "id">
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).add(loc);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Retrieve all queued pings for a ride, sorted oldest-first. */
export async function getPendingLocations(
  rideId: string
): Promise<QueuedLocation[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).index("rideId").getAll(rideId);
    req.onsuccess = () =>
      resolve(
        (req.result as QueuedLocation[]).sort((a, b) => a.timestamp - b.timestamp)
      );
    req.onerror = () => reject(req.error);
  });
}

/** Delete successfully uploaded pings by their auto-increment IDs. */
export async function removeLocations(ids: number[]): Promise<void> {
  if (!ids.length) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    for (const id of ids) store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Number of pings waiting to be sent for a given ride. */
export async function getPendingCount(rideId: string): Promise<number> {
  return (await getPendingLocations(rideId)).length;
}

/**
 * Flush all queued pings for a ride by calling the provided submit function.
 * Returns the number of pings successfully uploaded.
 * Stops early if any upload fails (network still down).
 */
export async function flushLocationQueue(
  rideId: string,
  submitFn: (loc: Omit<QueuedLocation, "id" | "rideId" | "timestamp">) => Promise<void>
): Promise<number> {
  const pending = await getPendingLocations(rideId);
  if (!pending.length) return 0;

  const sentIds: number[] = [];
  for (const loc of pending) {
    try {
      await submitFn({ lat: loc.lat, lng: loc.lng, speed: loc.speed, heading: loc.heading, accuracy: loc.accuracy });
      if (loc.id !== undefined) sentIds.push(loc.id);
    } catch {
      break; // network still unavailable — stop, keep remaining in queue
    }
  }

  await removeLocations(sentIds);
  return sentIds.length;
}
