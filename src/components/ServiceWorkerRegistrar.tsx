"use client";

import { useEffect } from "react";

/**
 * Registers the T2W service worker (/sw.js) once on mount.
 * This enables offline caching and Background Sync for live tracking.
 * Renders nothing — mount it once anywhere in the app shell.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((err) =>
          console.warn("[T2W] Service Worker registration failed:", err)
        );
    }
  }, []);

  return null;
}
