"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import type { UserRole } from "@/types";
import { type RolePermissions, DEFAULT_ROLE_PERMISSIONS } from "@/lib/role-permissions";

interface UserData {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  avatar?: string | null;
  role: UserRole;
  joinDate: string;
  isApproved: boolean;
  city?: string | null;
  ridingExperience?: string | null;
  totalKm: number;
  ridesCompleted: number;
  linkedRiderId?: string | null;
  motorcycles: Array<{
    id: string;
    make: string;
    model: string;
    year: number;
    cc: number;
    color: string;
    nickname?: string | null;
  }>;
  earnedBadges: Array<{
    id: string;
    earnedDate: string;
    badge: {
      id: string;
      tier: string;
      name: string;
      description: string;
      minKm: number;
      icon: string;
      color: string;
    };
  }>;
}

interface AuthContextType {
  user: UserData | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ user: UserData }>;
  sendResetOtp: (email: string) => Promise<{ emailSent: boolean }>;
  verifyResetOtp: (email: string, code: string) => Promise<void>;
  resetPassword: (email: string, newPassword: string) => Promise<void>;
  sendOtp: (email: string) => Promise<string>;
  verifyOtp: (email: string, code: string) => Promise<void>;
  register: (data: Record<string, unknown>) => Promise<{ user: UserData }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  // Role helpers
  isSuperAdmin: boolean;
  isCoreOrAbove: boolean;
  isT2WRiderOrAbove: boolean;
  isLoggedIn: boolean;
  canEditProfile: (profileRiderId: string) => boolean;
  canEditRide: boolean;
  canCreateRide: boolean;
  canDeleteRide: boolean;
  canApproveContent: boolean;
  canPostBlog: boolean;
  canPostRideTales: boolean;
  canManageRoles: boolean;
  canManageRegistrations: boolean;
  canExportRegistrations: boolean;
  canControlLiveTracking: boolean;
  canApproveUsers: boolean;
  canRegisterForRides: boolean;
  resolvedRolePerms: import("@/lib/role-permissions").RolePermissions;
  refreshRolePerms: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Something went wrong");
  }
  return data as T;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [rolePerms, setRolePerms] = useState<RolePermissions>(DEFAULT_ROLE_PERMISSIONS);

  useEffect(() => {
    fetch("/api/site-settings?key=role_permissions")
      .then((r) => r.json())
      .then((data) => {
        if (data.value) {
          setRolePerms({
            rider:       { ...DEFAULT_ROLE_PERMISSIONS.rider,       ...data.value.rider },
            t2w_rider:   { ...DEFAULT_ROLE_PERMISSIONS.t2w_rider,   ...data.value.t2w_rider },
            core_member: { ...DEFAULT_ROLE_PERMISSIONS.core_member, ...data.value.core_member },
          });
        }
      })
      .catch(() => {});
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const data = await apiFetch<{ user: UserData }>("/api/auth/me");
      setUser(data.user);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refreshUser().finally(() => setLoading(false));
  }, [refreshUser]);

  const login = async (email: string, password: string): Promise<{ user: UserData }> => {
    const data = await apiFetch<{ user: UserData }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setUser(data.user);
    return data;
  };

  const sendResetOtp = async (email: string): Promise<{ emailSent: boolean }> => {
    const data = await apiFetch<{ emailSent: boolean }>("/api/auth/send-reset-otp", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    return { emailSent: data.emailSent ?? true };
  };

  const verifyResetOtp = async (email: string, code: string): Promise<void> => {
    await apiFetch("/api/auth/verify-reset-otp", {
      method: "POST",
      body: JSON.stringify({ email, code }),
    });
  };

  const resetPassword = async (email: string, newPassword: string): Promise<void> => {
    await apiFetch("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ email, newPassword }),
    });
  };

  const sendOtp = async (email: string): Promise<string> => {
    const data = await apiFetch<{ message: string }>("/api/auth/send-otp", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    return data.message;
  };

  const verifyOtp = async (email: string, code: string): Promise<void> => {
    await apiFetch("/api/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ email, code }),
    });
  };

  const register = async (formData: Record<string, unknown>): Promise<{ user: UserData }> => {
    const data = await apiFetch<{ user: UserData }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(formData),
    });
    setUser(data.user);
    return data;
  };

  const logout = async () => {
    await apiFetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  };

  // Role-based permission helpers
  const role = user?.role;
  const isSuperAdmin = role === "superadmin";
  const isCoreOrAbove = role === "superadmin" || role === "core_member";
  const isT2WRiderOrAbove = role === "superadmin" || role === "core_member" || role === "t2w_rider";
  const isLoggedIn = !!user;

  const canEditProfile = (profileRiderId: string) => {
    if (isSuperAdmin) return true;
    if (!user) return false;
    if (role === "rider" && !rolePerms.rider.canEditOwnProfile) return false;
    return user.id === profileRiderId || user.linkedRiderId === profileRiderId;
  };

  // Core member permissions — gated by dynamic toggles (superadmin always has full access)
  const canCreateRide    = isSuperAdmin || (role === "core_member" && rolePerms.core_member.canCreateRide);
  const canEditRide      = isSuperAdmin || (role === "core_member" && rolePerms.core_member.canEditRide);
  const canDeleteRide    = isSuperAdmin;
  const canApproveContent = isSuperAdmin || (role === "core_member" && rolePerms.core_member.canApproveContent);
  const canManageRoles   = isSuperAdmin;
  const canManageRegistrations = isSuperAdmin || (role === "core_member" && rolePerms.core_member.canManageRegistrations);
  const canExportRegistrations = isSuperAdmin || (role === "core_member" && rolePerms.core_member.canExportRegistrations);
  const canControlLiveTracking = isSuperAdmin || (role === "core_member" && rolePerms.core_member.canControlLiveTracking);
  const canApproveUsers  = isSuperAdmin || (role === "core_member" && rolePerms.core_member.canApproveUsers);

  // T2W Rider permissions
  const canPostBlog =
    isSuperAdmin ||
    (role === "core_member") ||
    (role === "t2w_rider" && rolePerms.t2w_rider.canPostBlog);
  const canPostRideTales =
    isSuperAdmin ||
    (role === "core_member") ||
    (role === "t2w_rider" && rolePerms.t2w_rider.canPostRideTales);

  // Rider permissions
  const canRegisterForRides = isLoggedIn && (isCoreOrAbove || isT2WRiderOrAbove || rolePerms.rider.canRegisterForRides);

  // Expose current resolved permissions for the admin UI
  const resolvedRolePerms = rolePerms;
  const refreshRolePerms = () => {
    fetch("/api/site-settings?key=role_permissions")
      .then((r) => r.json())
      .then((data) => {
        if (data.value) {
          setRolePerms({
            rider:       { ...DEFAULT_ROLE_PERMISSIONS.rider,       ...data.value.rider },
            t2w_rider:   { ...DEFAULT_ROLE_PERMISSIONS.t2w_rider,   ...data.value.t2w_rider },
            core_member: { ...DEFAULT_ROLE_PERMISSIONS.core_member, ...data.value.core_member },
          });
        }
      })
      .catch(() => {});
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        sendResetOtp,
        verifyResetOtp,
        resetPassword,
        sendOtp,
        verifyOtp,
        register,
        logout,
        refreshUser,
        isSuperAdmin,
        isCoreOrAbove,
        isT2WRiderOrAbove,
        isLoggedIn,
        canEditProfile,
        canEditRide,
        canCreateRide,
        canDeleteRide,
        canApproveContent,
        canPostBlog,
        canPostRideTales,
        canManageRoles,
        canManageRegistrations,
        canExportRegistrations,
        canControlLiveTracking,
        canApproveUsers,
        canRegisterForRides,
        resolvedRolePerms,
        refreshRolePerms,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
