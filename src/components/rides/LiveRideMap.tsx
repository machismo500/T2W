"use client";

import { useEffect, useRef, useCallback } from "react";
import type { LiveRiderLocation } from "@/types";

interface LiveRideMapProps {
  plannedRoute?: { lat: number; lng: number }[];
  leadPath: { lat: number; lng: number }[];
  riders: LiveRiderLocation[];
  startLocation?: { lat: number; lng: number };
  endLocation?: { lat: number; lng: number };
  isEnded?: boolean;
}

// Color scheme for rider markers
const MARKER_COLORS = {
  lead: "#22c55e",    // green
  sweep: "#ef4444",   // red
  normal: "#3b82f6",  // blue
  deviated: "#f97316", // orange
};

export function LiveRideMap({
  plannedRoute,
  leadPath,
  riders,
  startLocation,
  endLocation,
  isEnded,
}: LiveRideMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const plannedPolyRef = useRef<google.maps.Polyline | null>(null);
  const leadPolyRef = useRef<google.maps.Polyline | null>(null);
  const markersRef = useRef<Map<string, google.maps.marker.AdvancedMarkerElement>>(new Map());
  const startMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const endMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || googleMapRef.current) return;

    const initMap = async () => {
      if (!window.google?.maps) return;

      const { Map } = await google.maps.importLibrary("maps") as google.maps.MapsLibrary;
      await google.maps.importLibrary("marker");

      const center = startLocation ||
        (plannedRoute?.[0]) ||
        (riders[0] ? { lat: riders[0].lat, lng: riders[0].lng } : { lat: 12.97, lng: 77.59 }); // Bangalore default

      googleMapRef.current = new Map(mapRef.current!, {
        center,
        zoom: 12,
        mapId: "live-ride-map",
        gestureHandling: "greedy",
        streetViewControl: false,
        mapTypeControl: true,
        mapTypeControlOptions: {
          position: google.maps.ControlPosition.TOP_RIGHT,
        },
      });
    };

    initMap();
  }, [startLocation, plannedRoute, riders]);

  // Draw planned route (grey dashed)
  useEffect(() => {
    if (!googleMapRef.current || !plannedRoute?.length) return;

    if (plannedPolyRef.current) {
      plannedPolyRef.current.setPath(plannedRoute);
    } else {
      plannedPolyRef.current = new google.maps.Polyline({
        path: plannedRoute,
        geodesic: true,
        strokeColor: "#9ca3af",
        strokeOpacity: 0.6,
        strokeWeight: 3,
        icons: [
          {
            icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 3 },
            offset: "0",
            repeat: "15px",
          },
        ],
        map: googleMapRef.current,
      });
    }
  }, [plannedRoute]);

  // Draw lead rider path (green solid)
  useEffect(() => {
    if (!googleMapRef.current) return;

    if (leadPath.length === 0) {
      if (leadPolyRef.current) {
        leadPolyRef.current.setMap(null);
        leadPolyRef.current = null;
      }
      return;
    }

    if (leadPolyRef.current) {
      leadPolyRef.current.setPath(leadPath);
    } else {
      leadPolyRef.current = new google.maps.Polyline({
        path: leadPath,
        geodesic: true,
        strokeColor: MARKER_COLORS.lead,
        strokeOpacity: 0.9,
        strokeWeight: 4,
        map: googleMapRef.current,
      });
    }
  }, [leadPath]);

  // Create marker element
  const createMarkerContent = useCallback(
    (rider: LiveRiderLocation) => {
      const color = rider.isLead
        ? MARKER_COLORS.lead
        : rider.isSweep
          ? MARKER_COLORS.sweep
          : rider.isDeviated
            ? MARKER_COLORS.deviated
            : MARKER_COLORS.normal;

      const label = rider.isLead
        ? "Lead"
        : rider.isSweep
          ? "Sweep"
          : rider.userName.split(" ")[0];

      const el = document.createElement("div");
      el.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;transform:translateY(-50%);">
          <div style="background:${color};color:white;font-size:11px;font-weight:600;padding:2px 6px;border-radius:4px;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.3);${rider.isDeviated ? "animation:pulse 1.5s infinite" : ""}">
            ${label}${rider.speed ? ` · ${Math.round(rider.speed)} km/h` : ""}
          </div>
          <div style="width:12px;height:12px;background:${color};border:2px solid white;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,0.3);margin-top:2px;"></div>
        </div>
      `;
      return el;
    },
    []
  );

  // Update rider markers
  useEffect(() => {
    if (!googleMapRef.current) return;

    const currentIds = new Set(riders.map((r) => r.userId));

    // Remove markers for riders no longer present
    for (const [id, marker] of markersRef.current) {
      if (!currentIds.has(id)) {
        marker.map = null;
        markersRef.current.delete(id);
      }
    }

    // Update/create markers
    for (const rider of riders) {
      const existing = markersRef.current.get(rider.userId);
      if (existing) {
        existing.position = { lat: rider.lat, lng: rider.lng };
        existing.content = createMarkerContent(rider);
      } else {
        const marker = new google.maps.marker.AdvancedMarkerElement({
          map: googleMapRef.current,
          position: { lat: rider.lat, lng: rider.lng },
          content: createMarkerContent(rider),
          title: rider.userName,
        });
        markersRef.current.set(rider.userId, marker);
      }
    }
  }, [riders, createMarkerContent]);

  // Start/End location markers
  useEffect(() => {
    if (!googleMapRef.current) return;

    if (startLocation && !startMarkerRef.current) {
      const el = document.createElement("div");
      el.innerHTML = `<div style="background:#16a34a;color:white;padding:4px 8px;border-radius:6px;font-weight:700;font-size:12px;box-shadow:0 2px 4px rgba(0,0,0,0.3);">🏁 START</div>`;
      startMarkerRef.current = new google.maps.marker.AdvancedMarkerElement({
        map: googleMapRef.current,
        position: startLocation,
        content: el,
      });
    }

    if (endLocation && !endMarkerRef.current) {
      const el = document.createElement("div");
      el.innerHTML = `<div style="background:#dc2626;color:white;padding:4px 8px;border-radius:6px;font-weight:700;font-size:12px;box-shadow:0 2px 4px rgba(0,0,0,0.3);">🏁 END</div>`;
      endMarkerRef.current = new google.maps.marker.AdvancedMarkerElement({
        map: googleMapRef.current,
        position: endLocation,
        content: el,
      });
    }
  }, [startLocation, endLocation]);

  // Fit bounds when map loads or riders change
  useEffect(() => {
    if (!googleMapRef.current) return;
    const bounds = new google.maps.LatLngBounds();
    let hasPoints = false;

    if (plannedRoute) {
      for (const p of plannedRoute) {
        bounds.extend(p);
        hasPoints = true;
      }
    }
    for (const r of riders) {
      bounds.extend({ lat: r.lat, lng: r.lng });
      hasPoints = true;
    }
    if (leadPath.length > 0) {
      for (const p of leadPath) {
        bounds.extend(p);
        hasPoints = true;
      }
    }

    if (hasPoints) {
      googleMapRef.current.fitBounds(bounds, 50);
    }
  }, [plannedRoute, riders, leadPath]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full rounded-lg" />
      {isEnded && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-gray-900/80 text-white px-4 py-2 rounded-full text-sm font-medium backdrop-blur-sm">
          Ride Completed — Post-Ride View
        </div>
      )}
      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
