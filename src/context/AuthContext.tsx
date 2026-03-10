"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import type { UserRole } from "@/types";

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
  login: (email: string, password: string) => Promise<void>;
  sendResetOtp: (email: string) => Promise<{ emailSent: boolean }>;
  verifyResetOtp: (email: string, code: string) => Promise<void>;
  resetPassword: (email: string, newPassword: string) => Promise<void>;
  sendOtp: (email: string) => Promise<string>;
  verifyOtp: (email: string, code: string) => Promise<void>;
  register: (data: Record<string, unknown>) => Promise<void>;
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
  canManageRoles: boolean;
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

  const login = async (email: string, password: string) => {
    const data = await apiFetch<{ user: UserData }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setUser(data.user);
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

  const register = async (formData: Record<string, unknown>) => {
    const data = await apiFetch<{ user: UserData }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(formData),
    });
    setUser(data.user);
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
    return user.id === profileRiderId || user.linkedRiderId === profileRiderId;
  };

  const canEditRide = isCoreOrAbove;
  const canCreateRide = isCoreOrAbove;
  const canDeleteRide = isSuperAdmin;
  const canApproveContent = isCoreOrAbove;
  const canPostBlog = isT2WRiderOrAbove;
  const canManageRoles = isSuperAdmin;

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
        canManageRoles,
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
