/**
 * Tests for the avatar memory cache + legacy localStorage purge in api-client.
 * Regression coverage for the iOS WebKit OOM caused by storing base64 data
 * URLs in localStorage and re-parsing the entire blob on every render.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// localStorage mock — vitest's jsdom env provides a baseline impl, but we
// reset it before each test for isolation.
function resetLocalStorage() {
  if (typeof localStorage !== "undefined") localStorage.clear();
}

describe("avatar cache (api-client)", () => {
  beforeEach(() => {
    resetLocalStorage();
    vi.resetModules(); // reload api-client so module-scope state resets
  });

  afterEach(() => {
    resetLocalStorage();
  });

  it("reads and writes from in-memory cache, not localStorage", async () => {
    const { api } = await import("@/lib/api-client");
    api.avatars.save("rider-1", "https://example.com/a.png");
    expect(api.avatars.get("rider-1")).toBe("https://example.com/a.png");
    // Should NOT touch localStorage at all (the whole point of the fix)
    expect(localStorage.length).toBe(0);
  });

  it("returns null for unknown riders", async () => {
    const { api } = await import("@/lib/api-client");
    expect(api.avatars.get("missing-rider")).toBe(null);
  });

  it("clears an entry when save() is called with empty string", async () => {
    const { api } = await import("@/lib/api-client");
    api.avatars.save("rider-1", "https://example.com/a.png");
    api.avatars.save("rider-1", "");
    expect(api.avatars.get("rider-1")).toBe(null);
  });

  it("evicts least-recently-used entries past the 50-entry cap", async () => {
    const { api } = await import("@/lib/api-client");
    // Insert 60 distinct entries; first 10 should be evicted.
    for (let i = 0; i < 60; i++) {
      api.avatars.save(`rider-${i}`, `https://example.com/${i}.png`);
    }
    // Most recent ones survive
    expect(api.avatars.get("rider-59")).toBe("https://example.com/59.png");
    expect(api.avatars.get("rider-50")).toBe("https://example.com/50.png");
    // Oldest ones got evicted
    expect(api.avatars.get("rider-0")).toBe(null);
    expect(api.avatars.get("rider-9")).toBe(null);
  });

  it("purges the legacy t2w_avatars blob on first access", async () => {
    // Pre-seed the legacy blob format that caused the OOM
    localStorage.setItem(
      "t2w_avatars",
      JSON.stringify({ "rider-A": "data:image/png;base64,AAAA" })
    );
    expect(localStorage.getItem("t2w_avatars")).not.toBeNull();

    const { api } = await import("@/lib/api-client");
    api.avatars.get("anything"); // first read triggers the purge

    expect(localStorage.getItem("t2w_avatars")).toBeNull();
  });

  it("purges all legacy t2w_avatar_<id> per-rider keys on first access", async () => {
    localStorage.setItem("t2w_avatar_rider-A", "data:image/png;base64,AAAA");
    localStorage.setItem("t2w_avatar_rider-B", "data:image/png;base64,BBBB");
    localStorage.setItem("unrelated_key", "keep-me");

    const { api } = await import("@/lib/api-client");
    api.avatars.save("trigger", "https://example.com/x.png"); // any avatar op triggers purge

    expect(localStorage.getItem("t2w_avatar_rider-A")).toBeNull();
    expect(localStorage.getItem("t2w_avatar_rider-B")).toBeNull();
    expect(localStorage.getItem("unrelated_key")).toBe("keep-me"); // untouched
  });

  it("legacy purge runs only once per page load (idempotent)", async () => {
    const { api } = await import("@/lib/api-client");
    const removeSpy = vi.spyOn(Storage.prototype, "removeItem");
    api.avatars.get("rider-1");
    api.avatars.get("rider-2");
    api.avatars.save("rider-3", "https://example.com/3.png");
    // removeItem should only be invoked during the first call
    // (one for the blob key + zero per-rider keys since none exist).
    expect(removeSpy).toHaveBeenCalledTimes(1);
    removeSpy.mockRestore();
  });
});
