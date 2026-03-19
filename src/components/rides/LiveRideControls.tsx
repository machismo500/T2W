"use client";

import { useState } from "react";
import { Play, Pause, Square, Coffee, MapPin, Radio } from "lucide-react";
import type { LiveRideSession } from "@/types";

interface LiveRideControlsProps {
  session: LiveRideSession | null;
  isAdmin: boolean;
  isTracking: boolean;
  hasJoined: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
  onJoin: () => void;
  onToggleTracking: () => void;
  onBreakStart: (reason?: string) => void;
  onBreakEnd: () => void;
}

export function LiveRideControls({
  session,
  isAdmin,
  isTracking,
  hasJoined,
  onStart,
  onPause,
  onResume,
  onEnd,
  onJoin,
  onToggleTracking,
  onBreakStart,
  onBreakEnd,
}: LiveRideControlsProps) {
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [breakReason, setBreakReason] = useState("");
  const [showBreakInput, setShowBreakInput] = useState(false);

  const status = session?.status || "waiting";
  const isOnBreak = status === "paused";

  const statusColors: Record<string, string> = {
    waiting: "bg-yellow-100 text-yellow-800",
    live: "bg-green-100 text-green-800",
    paused: "bg-orange-100 text-orange-800",
    ended: "bg-gray-100 text-gray-800",
  };

  const statusLabels: Record<string, string> = {
    waiting: "Waiting to Start",
    live: "Live",
    paused: "On Break",
    ended: "Ride Ended",
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 space-y-3">
      {/* Status Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {status === "live" && (
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
          )}
          <span
            className={`px-3 py-1 rounded-full text-sm font-semibold ${statusColors[status]}`}
          >
            {statusLabels[status]}
          </span>
        </div>
        {isTracking && (
          <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
            <Radio className="w-3 h-3" />
            GPS Active
          </span>
        )}
      </div>

      {/* Admin Controls */}
      {isAdmin && status !== "ended" && (
        <div className="flex flex-wrap gap-2">
          {!session && (
            <button
              onClick={onStart}
              className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Play className="w-4 h-4" />
              Start Ride
            </button>
          )}

          {status === "live" && (
            <>
              <button
                onClick={onPause}
                className="flex items-center gap-1.5 px-3 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Pause className="w-4 h-4" />
                Pause
              </button>

              {!showBreakInput ? (
                <button
                  onClick={() => setShowBreakInput(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <Coffee className="w-4 h-4" />
                  Call Break
                </button>
              ) : (
                <div className="flex items-center gap-2 w-full">
                  <input
                    type="text"
                    placeholder="Break reason (optional)"
                    value={breakReason}
                    onChange={(e) => setBreakReason(e.target.value)}
                    className="flex-1 px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600"
                  />
                  <button
                    onClick={() => {
                      onBreakStart(breakReason || undefined);
                      setBreakReason("");
                      setShowBreakInput(false);
                    }}
                    className="px-3 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium"
                  >
                    Start
                  </button>
                  <button
                    onClick={() => setShowBreakInput(false)}
                    className="px-3 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg text-sm"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </>
          )}

          {isOnBreak && (
            <button
              onClick={onBreakEnd}
              className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Play className="w-4 h-4" />
              End Break / Resume
            </button>
          )}

          {status === "paused" && !isOnBreak && (
            <button
              onClick={onResume}
              className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Play className="w-4 h-4" />
              Resume
            </button>
          )}

          {(status === "live" || status === "paused") && (
            <>
              {!showEndConfirm ? (
                <button
                  onClick={() => setShowEndConfirm(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <Square className="w-4 h-4" />
                  End Ride
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-red-600 font-medium">
                    End ride?
                  </span>
                  <button
                    onClick={() => {
                      onEnd();
                      setShowEndConfirm(false);
                    }}
                    className="px-3 py-1.5 bg-red-600 text-white rounded text-sm font-medium"
                  >
                    Yes, End
                  </button>
                  <button
                    onClick={() => setShowEndConfirm(false)}
                    className="px-3 py-1.5 bg-gray-200 dark:bg-gray-600 rounded text-sm"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Rider Controls */}
      {status !== "ended" && session && (
        <div className="flex flex-wrap gap-2 pt-1 border-t dark:border-gray-700">
          {!hasJoined ? (
            <button
              onClick={onJoin}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <MapPin className="w-4 h-4" />
              Join Ride
            </button>
          ) : (
            <button
              onClick={onToggleTracking}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isTracking
                  ? "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400"
                  : "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400"
              }`}
            >
              <Radio className="w-4 h-4" />
              {isTracking ? "Stop Tracking" : "Start Tracking"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
