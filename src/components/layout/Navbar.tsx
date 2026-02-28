"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Menu,
  X,
  User,
  LogIn,
  LogOut,
  Bike,
  Shield,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/rides", label: "T2W Tales" },
  { href: "/guidelines", label: "Guidelines" },
  { href: "/blogs", label: "Blogs & Vlogs" },
];

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  return (
    <nav
      role="navigation"
      aria-label="Main navigation"
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? "glass border-b border-white/5 py-3"
          : "bg-transparent py-5"
      }`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="group flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-t2w-accent to-red-600 transition-transform duration-300 group-hover:scale-110">
              <Bike className="h-5 w-5 text-white" />
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-t2w-accent to-red-600 opacity-0 blur-lg transition-opacity duration-300 group-hover:opacity-50" />
            </div>
            <div>
              <span className="font-display text-xl font-bold tracking-tight text-white">
                T2W
              </span>
              <span className="ml-1 hidden text-xs text-t2w-muted sm:inline">
                Tales on 2 Wheels
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden items-center gap-1 lg:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="relative rounded-lg px-4 py-2 text-sm font-medium text-gray-300 transition-all duration-200 hover:bg-white/5 hover:text-white"
                onMouseEnter={() => setActiveDropdown(link.label)}
                onMouseLeave={() => setActiveDropdown(null)}
              >
                {link.label}
                {activeDropdown === link.label && (
                  <span className="absolute bottom-0 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full bg-t2w-accent" />
                )}
              </Link>
            ))}
            {user && (
              <Link
                href="/dashboard"
                className="relative rounded-lg px-4 py-2 text-sm font-medium text-gray-300 transition-all duration-200 hover:bg-white/5 hover:text-white"
                onMouseEnter={() => setActiveDropdown("My Space")}
                onMouseLeave={() => setActiveDropdown(null)}
              >
                My Space
                {activeDropdown === "My Space" && (
                  <span className="absolute bottom-0 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full bg-t2w-accent" />
                )}
              </Link>
            )}
            {user && (user.role === "superadmin" || user.role === "core_member") && (
              <Link
                href="/admin"
                className="relative rounded-lg px-4 py-2 text-sm font-medium text-gray-300 transition-all duration-200 hover:bg-white/5 hover:text-white"
                onMouseEnter={() => setActiveDropdown("Admin")}
                onMouseLeave={() => setActiveDropdown(null)}
              >
                <Shield className="mr-1 inline h-3.5 w-3.5" />
                Admin
                {activeDropdown === "Admin" && (
                  <span className="absolute bottom-0 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full bg-t2w-accent" />
                )}
              </Link>
            )}
          </div>

          {/* Desktop Actions */}
          <div className="hidden items-center gap-3 lg:flex">
            {loading ? (
              <div className="h-9 w-24 animate-pulse rounded-xl bg-t2w-surface" />
            ) : user ? (
              <>
                <Link
                  href="/dashboard"
                  className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-300 transition-all duration-200 hover:bg-white/5 hover:text-white"
                >
                  <User className="h-4 w-4" />
                  {user.name.split(" ")[0]}
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-300 transition-all duration-200 hover:bg-white/5 hover:text-white"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-300 transition-all duration-200 hover:bg-white/5 hover:text-white"
                >
                  <LogIn className="h-4 w-4" />
                  Login
                </Link>
                <Link
                  href="/register"
                  className="btn-primary flex items-center gap-2 !px-5 !py-2.5 text-sm"
                >
                  <User className="h-4 w-4" />
                  Join T2W
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="rounded-lg p-2 text-gray-300 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Toggle menu"
          >
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="mt-4 animate-slide-down rounded-2xl border border-t2w-border bg-t2w-surface p-4 lg:hidden">
            <div className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className="rounded-xl px-4 py-3 text-sm font-medium text-gray-300 transition-colors hover:bg-white/5 hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
              {user && (
                <Link
                  href="/dashboard"
                  onClick={() => setIsOpen(false)}
                  className="rounded-xl px-4 py-3 text-sm font-medium text-gray-300 transition-colors hover:bg-white/5 hover:text-white"
                >
                  My Space
                </Link>
              )}
              {user && (user.role === "superadmin" || user.role === "core_member") && (
                <Link
                  href="/admin"
                  onClick={() => setIsOpen(false)}
                  className="rounded-xl px-4 py-3 text-sm font-medium text-gray-300 transition-colors hover:bg-white/5 hover:text-white"
                >
                  Admin Panel
                </Link>
              )}
              <hr className="my-2 border-t2w-border" />
              {user ? (
                <>
                  <Link
                    href="/dashboard"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-gray-300 transition-colors hover:bg-white/5 hover:text-white"
                  >
                    <User className="h-4 w-4" />
                    {user.name}
                  </Link>
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      handleLogout();
                    }}
                    className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-gray-300 transition-colors hover:bg-white/5 hover:text-white"
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-gray-300 transition-colors hover:bg-white/5 hover:text-white"
                  >
                    <LogIn className="h-4 w-4" />
                    Login
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setIsOpen(false)}
                    className="btn-primary mt-1 text-center text-sm"
                  >
                    Join T2W
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
