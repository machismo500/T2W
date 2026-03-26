"use client";

import { useState, useEffect } from "react";
import { Save, Loader2, Trophy, Award } from "lucide-react";
import { api } from "@/lib/api-client";
import { DEFAULT_ARENA_WEIGHTS } from "@/components/riders/types";
import type { ArenaWeights } from "@/components/riders/types";

type AchievementSettings = {
  periodStart: string;
  periodEnd: string;
  pointsPerParticipation: number;
  pointsPerOrganize: number;
  pointsPerSweep: number;
  thresholdPercent: number;
};

const DEFAULT_ACHIEVEMENT: AchievementSettings = {
  periodStart: "",
  periodEnd: "",
  pointsPerParticipation: 5,
  pointsPerOrganize: 5,
  pointsPerSweep: 5,
  thresholdPercent: 75,
};

export function ArenaSettingsTab() {
  const [weights, setWeights] = useState<ArenaWeights>({ ...DEFAULT_ARENA_WEIGHTS });
  const [achievement, setAchievement] = useState<AchievementSettings>({ ...DEFAULT_ACHIEVEMENT });
  const [loadingWeights, setLoadingWeights] = useState(true);
  const [loadingAchievement, setLoadingAchievement] = useState(true);
  const [savingWeights, setSavingWeights] = useState(false);
  const [savingAchievement, setSavingAchievement] = useState(false);
  const [weightsSaved, setWeightsSaved] = useState(false);
  const [achievementSaved, setAchievementSaved] = useState(false);

  useEffect(() => {
    api.arenaWeights.get().then((data: ArenaWeights | null) => {
      if (data) setWeights(data);
      setLoadingWeights(false);
    });
    api.achievementSettings.get().then((data: AchievementSettings | null) => {
      if (data) setAchievement(data);
      setLoadingAchievement(false);
    });
  }, []);

  const handleSaveWeights = async () => {
    setSavingWeights(true);
    setWeightsSaved(false);
    try {
      await api.arenaWeights.save(weights);
      setWeightsSaved(true);
      setTimeout(() => setWeightsSaved(false), 3000);
    } catch (err) {
      console.error("Failed to save arena weights:", err);
    } finally {
      setSavingWeights(false);
    }
  };

  const handleSaveAchievement = async () => {
    setSavingAchievement(true);
    setAchievementSaved(false);
    try {
      await api.achievementSettings.save(achievement);
      setAchievementSaved(true);
      setTimeout(() => setAchievementSaved(false), 3000);
    } catch (err) {
      console.error("Failed to save achievement settings:", err);
    } finally {
      setSavingAchievement(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Arena Score Weights */}
      <div className="rounded-xl border border-t2w-border bg-t2w-surface/60 p-6">
        <div className="mb-5 flex items-center gap-2">
          <Trophy className="h-5 w-5 text-t2w-accent" />
          <h3 className="text-lg font-semibold text-white">Arena Score Weights</h3>
        </div>
        <p className="mb-4 text-sm text-t2w-muted">
          Configure how many points each activity contributes to the Arena Score.
        </p>

        {loadingWeights ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-t2w-accent" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-t2w-muted">
                  Points per Ride
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={weights.ridesCompleted}
                  onChange={(e) => setWeights({ ...weights, ridesCompleted: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded-lg border border-t2w-border bg-t2w-dark px-3 py-2 text-sm text-white focus:border-t2w-accent/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-t2w-muted">
                  Points per Organised
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={weights.ridesOrganized}
                  onChange={(e) => setWeights({ ...weights, ridesOrganized: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded-lg border border-t2w-border bg-t2w-dark px-3 py-2 text-sm text-white focus:border-t2w-accent/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-t2w-muted">
                  Points per Sweep
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={weights.sweepsDone}
                  onChange={(e) => setWeights({ ...weights, sweepsDone: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded-lg border border-t2w-border bg-t2w-dark px-3 py-2 text-sm text-white focus:border-t2w-accent/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-t2w-muted">
                  Points per KM
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={weights.totalKm}
                  onChange={(e) => setWeights({ ...weights, totalKm: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded-lg border border-t2w-border bg-t2w-dark px-3 py-2 text-sm text-white focus:border-t2w-accent/50 focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-4 rounded-lg bg-t2w-dark/60 p-3 text-xs text-t2w-muted">
              <strong className="text-white">Formula:</strong> Arena Score = (Rides × {weights.ridesCompleted}) + (Organised × {weights.ridesOrganized}) + (Sweeps × {weights.sweepsDone}) + (KM × {weights.totalKm})
            </div>

            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={handleSaveWeights}
                disabled={savingWeights}
                className="inline-flex items-center gap-2 rounded-lg bg-t2w-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-t2w-accent/80 disabled:opacity-50"
              >
                {savingWeights ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Weights
              </button>
              {weightsSaved && (
                <span className="text-sm text-green-400">Saved successfully!</span>
              )}
            </div>
          </>
        )}
      </div>

      {/* Achievement Period Settings */}
      <div className="rounded-xl border border-t2w-border bg-t2w-surface/60 p-6">
        <div className="mb-5 flex items-center gap-2">
          <Award className="h-5 w-5 text-t2w-gold" />
          <h3 className="text-lg font-semibold text-white">Achievement Period Settings</h3>
        </div>
        <p className="mb-4 text-sm text-t2w-muted">
          Configure the evaluation period and point values for achievement highlighting.
          Riders who earn at least the threshold percentage of max possible points will be highlighted.
        </p>

        {loadingAchievement ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-t2w-accent" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-t2w-muted">
                  Period Start Date
                </label>
                <input
                  type="date"
                  value={achievement.periodStart}
                  onChange={(e) => setAchievement({ ...achievement, periodStart: e.target.value })}
                  className="w-full rounded-lg border border-t2w-border bg-t2w-dark px-3 py-2 text-sm text-white focus:border-t2w-accent/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-t2w-muted">
                  Period End Date
                </label>
                <input
                  type="date"
                  value={achievement.periodEnd}
                  onChange={(e) => setAchievement({ ...achievement, periodEnd: e.target.value })}
                  className="w-full rounded-lg border border-t2w-border bg-t2w-dark px-3 py-2 text-sm text-white focus:border-t2w-accent/50 focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-4 rounded-lg bg-t2w-dark/60 p-3 text-xs text-t2w-muted">
              <strong className="text-white">Participation points (fixed by ride type):</strong>{" "}
              Day / Weekend / Multi-day = 5 pts · Expedition = 10 pts
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-t2w-muted">
                  Points per Organise
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={achievement.pointsPerOrganize}
                  onChange={(e) => setAchievement({ ...achievement, pointsPerOrganize: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded-lg border border-t2w-border bg-t2w-dark px-3 py-2 text-sm text-white focus:border-t2w-accent/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-t2w-muted">
                  Points per Sweep
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={achievement.pointsPerSweep}
                  onChange={(e) => setAchievement({ ...achievement, pointsPerSweep: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded-lg border border-t2w-border bg-t2w-dark px-3 py-2 text-sm text-white focus:border-t2w-accent/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-t2w-muted">
                  Threshold (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={achievement.thresholdPercent}
                  onChange={(e) => setAchievement({ ...achievement, thresholdPercent: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded-lg border border-t2w-border bg-t2w-dark px-3 py-2 text-sm text-white focus:border-t2w-accent/50 focus:outline-none"
                />
              </div>
            </div>

            {achievement.periodStart && achievement.periodEnd && (
              <div className="mt-4 rounded-lg bg-t2w-dark/60 p-3 text-xs text-t2w-muted">
                <strong className="text-white">Preview:</strong>{" "}
                Base points = sum of participation pts per ride (5 or 10 by type).{" "}
                Threshold = {achievement.thresholdPercent}% of base points. Riders achieving ≥ {achievement.thresholdPercent}% will be highlighted.
              </div>
            )}

            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={handleSaveAchievement}
                disabled={savingAchievement}
                className="inline-flex items-center gap-2 rounded-lg bg-t2w-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-t2w-accent/80 disabled:opacity-50"
              >
                {savingAchievement ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Achievement Settings
              </button>
              {achievementSaved && (
                <span className="text-sm text-green-400">Saved successfully!</span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
