"use client";

import { useState } from "react";
import { Shield, Bike, Star, Users, ToggleLeft, ToggleRight, Save, Loader2, RotateCcw } from "lucide-react";
import { type RolePermissions, DEFAULT_ROLE_PERMISSIONS } from "@/lib/role-permissions";

type Props = {
  resolvedRolePerms: RolePermissions;
  onSaved: () => void;
};

type Section = {
  role: keyof RolePermissions;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  borderColor: string;
  features: { key: string; label: string; description: string }[];
};

const SECTIONS: Section[] = [
  {
    role: "rider",
    label: "Rider",
    description: "Base level — freshly approved members",
    icon: Bike,
    color: "text-blue-400",
    borderColor: "border-blue-400/30",
    features: [
      { key: "canRegisterForRides", label: "Register for Rides", description: "Can sign up for upcoming rides" },
      { key: "canEditOwnProfile", label: "Edit Own Profile", description: "Can update name, phone, emergency contact, etc." },
    ],
  },
  {
    role: "t2w_rider",
    label: "T2W Rider",
    description: "Trusted club members — inherits all Rider permissions",
    icon: Star,
    color: "text-yellow-400",
    borderColor: "border-yellow-400/30",
    features: [
      { key: "canPostBlog", label: "Write Blog Posts", description: "Can submit blog posts (requires mod approval)" },
      { key: "canPostRideTales", label: "Post Ride Tales", description: "Can post ride stories on completed rides (requires mod approval)" },
      { key: "earlyRegistrationAccess", label: "Early Registration Access", description: "Can register before the general public when a ride has a T2W-specific open date" },
    ],
  },
  {
    role: "core_member",
    label: "Core Member",
    description: "Organiser level — inherits all T2W Rider permissions",
    icon: Users,
    color: "text-t2w-accent",
    borderColor: "border-t2w-accent/30",
    features: [
      { key: "canCreateRide", label: "Create Rides", description: "Can add new rides to the schedule" },
      { key: "canEditRide", label: "Edit Rides", description: "Can update ride details, status, and route" },
      { key: "canManageRegistrations", label: "Manage Registrations", description: "Can approve, reject, and manually add riders to rides" },
      { key: "canExportRegistrations", label: "Export Registrations", description: "Can download the rider list as a spreadsheet" },
      { key: "canControlLiveTracking", label: "Control Live Tracking", description: "Can start, pause, call breaks, and end live ride sessions" },
      { key: "canApproveContent", label: "Approve Content", description: "Can approve/reject blog posts and ride tales" },
      { key: "canApproveUsers", label: "Approve New Members", description: "Can approve or reject pending user sign-ups" },
    ],
  },
];

export function PermissionsTab({ resolvedRolePerms, onSaved }: Props) {
  const [perms, setPerms] = useState<RolePermissions>(resolvedRolePerms);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const toggle = (role: keyof RolePermissions, key: string) => {
    setPerms((prev) => ({
      ...prev,
      [role]: {
        ...(prev[role] as Record<string, boolean>),
        [key]: !(prev[role] as Record<string, boolean>)[key],
      },
    }));
    setSaved(false);
  };

  const reset = () => {
    setPerms(DEFAULT_ROLE_PERMISSIONS);
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/site-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "role_permissions", value: perms }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setSaved(true);
      onSaved();
    } catch {
      // noop — could show a toast here
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="font-display text-xl font-bold text-white">Role Permissions</h3>
          <p className="mt-1 text-sm text-t2w-muted">
            Enable or disable features for each role. Super Admin always has full access.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={reset}
            className="flex items-center gap-1.5 rounded-lg bg-t2w-surface-light px-3 py-2 text-xs text-t2w-muted transition-colors hover:text-white"
          >
            <RotateCcw className="h-3.5 w-3.5" />Reset to defaults
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-t2w-accent px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {saving ? "Saving…" : saved ? "Saved ✓" : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Super Admin note */}
      <div className="mb-6 flex items-start gap-3 rounded-xl border border-t2w-gold/30 bg-t2w-gold/10 p-4">
        <Shield className="mt-0.5 h-4 w-4 shrink-0 text-t2w-gold" />
        <p className="text-sm text-t2w-gold">
          <strong>Super Admin</strong> always has unrestricted access to every feature regardless of these settings.
        </p>
      </div>

      <div className="space-y-6">
        {SECTIONS.map(({ role, label, description, icon: Icon, color, borderColor, features }) => (
          <div key={role} className={`rounded-2xl border ${borderColor} bg-t2w-surface p-5`}>
            {/* Role header */}
            <div className="mb-4 flex items-center gap-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl border ${borderColor} bg-t2w-surface-light`}>
                <Icon className={`h-4.5 w-4.5 ${color}`} />
              </div>
              <div>
                <h4 className={`font-semibold ${color}`}>{label}</h4>
                <p className="text-xs text-t2w-muted">{description}</p>
              </div>
            </div>

            {/* Feature toggles */}
            <div className="space-y-1">
              {features.map(({ key, label: featureLabel, description: featureDesc }) => {
                const enabled = (perms[role] as Record<string, boolean>)[key] ?? true;
                return (
                  <button
                    key={key}
                    onClick={() => toggle(role, key)}
                    className="flex w-full items-center gap-4 rounded-xl px-3 py-3 text-left transition-colors hover:bg-t2w-surface-light"
                  >
                    {enabled
                      ? <ToggleRight className={`h-6 w-6 shrink-0 ${color}`} />
                      : <ToggleLeft className="h-6 w-6 shrink-0 text-t2w-muted" />}
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${enabled ? "text-white" : "text-t2w-muted"}`}>
                        {featureLabel}
                      </p>
                      <p className="text-xs text-t2w-muted">{featureDesc}</p>
                    </div>
                    <span className={`shrink-0 rounded-lg px-2 py-0.5 text-xs font-medium ${
                      enabled ? "bg-green-400/10 text-green-400" : "bg-red-400/10 text-red-400"
                    }`}>
                      {enabled ? "Enabled" : "Disabled"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
