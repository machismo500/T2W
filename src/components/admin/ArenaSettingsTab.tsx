"use client";

import { useState, useEffect } from "react";
import { Save, Loader2, Trophy, Award } from "lucide-react";
import { api } from "@/lib/api-client";
import { DEFAULT_ARENA_WEIGHTS } from "@/components/riders/types";
import type { ArenaWeights } from "@/components/riders/types";

type AchievementSettings = {
  periodStart: string;
  periodEnd: string;
  ptsDay: number;
  ptsWeekend: number;
  ptsMultiDay: number;
  ptsExpedition: number;
  thresholdPtsDay: number;
  thresholdPtsWeekend: number;
  thresholdPtsMultiDay: number;
  thresholdPtsExpedition: number;
  pointsPerOrganize: number;
  pointsPerSweep: number;
  thresholdPercent: number;
};

const DEFAULT_ACHIEVEMENT: AchievementSettings = {
  periodStart: "",
  periodEnd: "",
  ptsDay: 5,
  ptsWeekend: 5,
  ptsMultiDay: 5,
  ptsExpedition: 10,
  thresholdPtsDay: 5,
  thresholdPtsWeekend: 5,
  thresholdPtsMultiDay: 5,
  thresholdPtsExpedition: 5,
  pointsPerOrganize: 5,
  pointsPerSweep: 5,
  thresholdPercent: 75,
};

function NumberInput({
  label,
  value,
  step = "0.5",
  onChange,
}: {
  label: string;
  value: number;
  step?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-t2w-muted">{label}</label>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-full rounded-lg border border-t2w-border bg-t2w-dark px-3 py-2 text-sm text-white focus:border-t2w-accent/50 focus:outline-none"
      />
    </div>
  );
}

function RidePointsGrid({
  ptsDay,
  ptsWeekend,
  ptsMultiDay,
  ptsExpedition,
  onChange,
}: {
  ptsDay: number;
  ptsWeekend: number;
  ptsMultiDay: number;
  ptsExpedition: number;
  onChange: (field: string, v: number) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <NumberInput label="Day Ride" value={ptsDay} onChange={(v) => onChange("ptsDay", v)} />
      <NumberInput label="Weekend Ride" value={ptsWeekend} onChange={(v) => onChange("ptsWeekend", v)} />
      <NumberInput label="Multi-Day Ride" value={ptsMultiDay} onChange={(v) => onChange("ptsMultiDay", v)} />
      <NumberInput label="Expedition" value={ptsExpedition} onChange={(v) => onChange("ptsExpedition", v)} />
    </div>
  );
}

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
      if (data) {
        // Migrate old format (ridesCompleted) to new per-type format
        const legacy = data as ArenaWeights & { ridesCompleted?: number };
        if (legacy.ridesCompleted !== undefined && data.ptsDay === undefined) {
          setWeights({
            ...DEFAULT_ARENA_WEIGHTS,
            ptsDay: legacy.ridesCompleted,
            ptsWeekend: legacy.ridesCompleted,
            ptsMultiDay: legacy.ridesCompleted,
            ptsExpedition: legacy.ridesCompleted,
            ridesOrganized: data.ridesOrganized ?? DEFAULT_ARENA_WEIGHTS.ridesOrganized,
            sweepsDone: data.sweepsDone ?? DEFAULT_ARENA_WEIGHTS.sweepsDone,
            totalKm: data.totalKm ?? DEFAULT_ARENA_WEIGHTS.totalKm,
          });
        } else {
          setWeights({ ...DEFAULT_ARENA_WEIGHTS, ...data });
        }
      }
      setLoadingWeights(false);
    });

    api.achievementSettings.get().then((data: AchievementSettings | null) => {
      if (data) {
        // Migrate old format (pointsPerParticipation) to new per-type format
        const legacy = data as AchievementSettings & { pointsPerParticipation?: number };
        if (legacy.pointsPerParticipation !== undefined && data.ptsDay === undefined) {
          setAchievement({
            ...DEFAULT_ACHIEVEMENT,
            ...data,
            ptsDay: legacy.pointsPerParticipation,
            ptsWeekend: legacy.pointsPerParticipation,
            ptsMultiDay: legacy.pointsPerParticipation,
            ptsExpedition: legacy.pointsPerParticipation,
          });
        } else {
          setAchievement({ ...DEFAULT_ACHIEVEMENT, ...data });
        }
      }
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
      {/* ── Arena Score Weights (Leaderboard) ── */}
      <div className="rounded-xl border border-t2w-border bg-t2w-surface/60 p-6">
        <div className="mb-2 flex items-center gap-2">
          <Trophy className="h-5 w-5 text-t2w-accent" />
          <h3 className="text-lg font-semibold text-white">Arena Score Weights</h3>
        </div>
        <p className="mb-5 text-sm text-t2w-muted">
          Configure how each activity contributes to the Leaderboard Arena Score.
        </p>

        {loadingWeights ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-t2w-accent" />
          </div>
        ) : (
          <>
            {/* Points Per Ride */}
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-t2w-muted">
              Points Per Ride
            </p>
            <RidePointsGrid
              ptsDay={weights.ptsDay}
              ptsWeekend={weights.ptsWeekend}
              ptsMultiDay={weights.ptsMultiDay}
              ptsExpedition={weights.ptsExpedition}
              onChange={(field, v) => setWeights({ ...weights, [field]: v })}
            />

            {/* Other weights */}
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <NumberInput
                label="Points Per Organised"
                value={weights.ridesOrganized}
                onChange={(v) => setWeights({ ...weights, ridesOrganized: v })}
              />
              <NumberInput
                label="Points Per Sweep"
                value={weights.sweepsDone}
                onChange={(v) => setWeights({ ...weights, sweepsDone: v })}
              />
              <NumberInput
                label="Points Per KM"
                step="0.001"
                value={weights.totalKm}
                onChange={(v) => setWeights({ ...weights, totalKm: v })}
              />
            </div>

            <div className="mt-4 rounded-lg bg-t2w-dark/60 p-3 text-xs text-t2w-muted">
              <strong className="text-white">Formula:</strong> Arena Score = (Day × {weights.ptsDay}) + (Weekend × {weights.ptsWeekend}) + (Multi-day × {weights.ptsMultiDay}) + (Expedition × {weights.ptsExpedition}) + (Organised × {weights.ridesOrganized}) + (Sweeps × {weights.sweepsDone}) + (KM × {weights.totalKm})
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
              {weightsSaved && <span className="text-sm text-green-400">Saved successfully!</span>}
            </div>
          </>
        )}
      </div>

      {/* ── Active Status Period Settings ── */}
      <div className="rounded-xl border border-t2w-border bg-t2w-surface/60 p-6">
        <div className="mb-2 flex items-center gap-2">
          <Award className="h-5 w-5 text-t2w-gold" />
          <h3 className="text-lg font-semibold text-white">Active Status Period Settings</h3>
        </div>
        <p className="mb-5 text-sm text-t2w-muted">
          Configure the evaluation period and point values for Active Status highlighting.
          Riders who earn at least the threshold percentage of the threshold base points will be highlighted.
        </p>

        {loadingAchievement ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-t2w-accent" />
          </div>
        ) : (
          <>
            {/* Dates */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-t2w-muted">Period Start Date</label>
                <input
                  type="date"
                  value={achievement.periodStart}
                  onChange={(e) => setAchievement({ ...achievement, periodStart: e.target.value })}
                  className="w-full rounded-lg border border-t2w-border bg-t2w-dark px-3 py-2 text-sm text-white focus:border-t2w-accent/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-t2w-muted">Period End Date</label>
                <input
                  type="date"
                  value={achievement.periodEnd}
                  onChange={(e) => setAchievement({ ...achievement, periodEnd: e.target.value })}
                  className="w-full rounded-lg border border-t2w-border bg-t2w-dark px-3 py-2 text-sm text-white focus:border-t2w-accent/50 focus:outline-none"
                />
              </div>
            </div>

            {/* Participation Points Per Ride */}
            <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wider text-t2w-muted">
              Participation Points Per Ride
            </p>
            <RidePointsGrid
              ptsDay={achievement.ptsDay}
              ptsWeekend={achievement.ptsWeekend}
              ptsMultiDay={achievement.ptsMultiDay}
              ptsExpedition={achievement.ptsExpedition}
              onChange={(field, v) => setAchievement({ ...achievement, [field]: v })}
            />

            {/* Organise / Sweep */}
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumberInput
                label="Points Per Organised"
                value={achievement.pointsPerOrganize}
                onChange={(v) => setAchievement({ ...achievement, pointsPerOrganize: v })}
              />
              <NumberInput
                label="Points Per Sweep"
                value={achievement.pointsPerSweep}
                onChange={(v) => setAchievement({ ...achievement, pointsPerSweep: v })}
              />
            </div>

            {/* Threshold Settings */}
            <p className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider text-t2w-muted">
              Threshold Settings
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumberInput
                label="Threshold (%)"
                step="1"
                value={achievement.thresholdPercent}
                onChange={(v) => setAchievement({ ...achievement, thresholdPercent: v })}
              />
            </div>

            <p className="mb-2 mt-4 text-xs text-t2w-muted">
              Threshold base points per ride type (used to calculate the minimum required score):
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <NumberInput
                label="Day Ride"
                value={achievement.thresholdPtsDay}
                onChange={(v) => setAchievement({ ...achievement, thresholdPtsDay: v })}
              />
              <NumberInput
                label="Weekend Ride"
                value={achievement.thresholdPtsWeekend}
                onChange={(v) => setAchievement({ ...achievement, thresholdPtsWeekend: v })}
              />
              <NumberInput
                label="Multi-Day Ride"
                value={achievement.thresholdPtsMultiDay}
                onChange={(v) => setAchievement({ ...achievement, thresholdPtsMultiDay: v })}
              />
              <NumberInput
                label="Expedition"
                value={achievement.thresholdPtsExpedition}
                onChange={(v) => setAchievement({ ...achievement, thresholdPtsExpedition: v })}
              />
            </div>

            {achievement.periodStart && achievement.periodEnd && (
              <div className="mt-4 rounded-lg bg-t2w-dark/60 p-3 text-xs text-t2w-muted">
                <strong className="text-white">Preview:</strong>{" "}
                Threshold base = sum of threshold pts per ride in period (Day={achievement.thresholdPtsDay}, Weekend={achievement.thresholdPtsWeekend}, Multi-day={achievement.thresholdPtsMultiDay}, Expedition={achievement.thresholdPtsExpedition}).{" "}
                Riders achieving ≥ {achievement.thresholdPercent}% of threshold base will be highlighted.
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
              {achievementSaved && <span className="text-sm text-green-400">Saved successfully!</span>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
