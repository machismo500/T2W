"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, User, LayoutDashboard, LogOut, Shield } from "lucide-react";

type MinimalUser = {
  name: string;
  role: string;
  linkedRiderId?: string | null;
  avatarUrl?: string | null;
};

interface UserMenuProps {
  user: MinimalUser;
  onLogout: () => void;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function UserMenu({ user, onLogout }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const isAdmin = user.role === "superadmin" || user.role === "core_member";
  const profileHref = user.linkedRiderId ? `/rider/${user.linkedRiderId}` : "/rides";

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Open user menu"
        className="flex items-center gap-2 rounded-xl border border-t2w-border bg-t2w-surface/60 px-2 py-1.5 text-sm text-gray-200 transition-all hover:border-t2w-accent/40 hover:bg-t2w-surface"
      >
        <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-t2w-accent to-red-600 text-xs font-bold text-white">
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt={user.name} className="h-full w-full object-cover" />
          ) : (
            getInitials(user.name)
          )}
        </span>
        <span className="max-w-[120px] truncate font-medium">{user.name.split(" ")[0]}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-t2w-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.18, ease: "easeOut" as const }}
            role="menu"
            className="absolute right-0 mt-2 w-60 origin-top-right overflow-hidden rounded-2xl border border-t2w-border bg-t2w-surface/95 shadow-2xl backdrop-blur"
          >
            <div className="border-b border-t2w-border px-4 py-3">
              <p className="truncate text-sm font-semibold text-white">{user.name}</p>
              <p className="mt-0.5 truncate text-xs text-t2w-muted capitalize">
                {user.role.replace("_", " ")}
              </p>
            </div>
            <div className="p-1.5">
              <Link
                href={profileHref}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-gray-200 transition-colors hover:bg-white/5 hover:text-white"
              >
                <User className="h-4 w-4 text-t2w-accent" />
                My Profile
              </Link>
              <Link
                href="/rides"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-gray-200 transition-colors hover:bg-white/5 hover:text-white"
              >
                <LayoutDashboard className="h-4 w-4 text-t2w-accent" />
                My Rides
              </Link>
              {isAdmin && (
                <Link
                  href="/admin"
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-gray-200 transition-colors hover:bg-white/5 hover:text-white"
                >
                  <Shield className="h-4 w-4 text-t2w-gold" />
                  Admin Panel
                </Link>
              )}
            </div>
            <div className="border-t border-t2w-border p-1.5">
              <button
                onClick={() => {
                  setOpen(false);
                  onLogout();
                }}
                role="menuitem"
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-gray-200 transition-colors hover:bg-red-500/10 hover:text-red-400"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
