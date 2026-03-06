"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { api } from "@/lib/api-client";
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
  resetPassword: (email: string) => Promise<string>;
  sendOtp: (email: string) => Promise<string>;
  verifyOtp: (email: string, code: string) => Promise<void>;
  register: (data: Record<string, unknown>) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  // Role helpers
  isSuperAdmin: boolean;
  isCoreOrAbove: boolean; // superadmin or core_member
  isT2WRiderOrAbove: boolean; // superadmin, core_member, or t2w_rider
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const raw = await api.auth.me();
      const data = raw as unknown as { user: UserData };
      setUser(data.user);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refreshUser().finally(() => setLoading(false));
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    const raw = await api.auth.login(email, password);
    const data = raw as unknown as { user: UserData };
    setUser(data.user);
  };

  const resetPassword = async (email: string): Promise<string> => {
    const result = await api.auth.resetPassword(email);
    const data = result as unknown as { tempPassword: string };
    return data.tempPassword;
  };

  const sendOtp = async (email: string): Promise<string> => {
    const result = await api.auth.sendOtp(email);
    const data = result as unknown as { message: string };
    return data.message;
  };

  const verifyOtp = async (email: string, code: string): Promise<void> => {
    await api.auth.verifyOtp(email, code);
  };

  const register = async (formData: Record<string, unknown>) => {
    const raw = await api.auth.register(formData);
    const data = raw as unknown as { user: UserData };
    setUser(data.user);
  };

  const logout = async () => {
    await api.auth.logout();
    setUser(null);
  };

  // Role-based permission helpers
  const role = user?.role;
  const isSuperAdmin = role === "superadmin";
  const isCoreOrAbove = role === "superadmin" || role === "core_member";
  const isT2WRiderOrAbove = role === "superadmin" || role === "core_member" || role === "t2w_rider";
  const isLoggedIn = !!user;

  // SuperAdmin can edit any profile; others can only edit their own
  const canEditProfile = (profileRiderId: string) => {
    if (isSuperAdmin) return true;
    if (!user) return false;
    return user.linkedRiderId === profileRiderId;
  };

  // Core Member + SuperAdmin can edit/save ride posts and posters
  const canEditRide = isCoreOrAbove;
  // Core Member + SuperAdmin can create rides
  const canCreateRide = isCoreOrAbove;
  // Only SuperAdmin can delete rides
  const canDeleteRide = isSuperAdmin;
  // Core Member + SuperAdmin can approve blogs and posts
  const canApproveContent = isCoreOrAbove;
  // T2W Rider and above can post blogs (subject to approval)
  const canPostBlog = isT2WRiderOrAbove;
  // Only SuperAdmin can manage user roles
  const canManageRoles = isSuperAdmin;

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
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
