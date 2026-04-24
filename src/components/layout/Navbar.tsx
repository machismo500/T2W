"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X, LogIn, User, Shield } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { UserMenu } from "@/components/shared/UserMenu";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/rides", label: "Rides" },
  { href: "/riders", label: "Arena" },
  { href: "/guidelines", label: "Guidelines" },
  { href: "/blogs", label: "Blogs & Vlogs" },
];

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Lock body scroll while the mobile sheet is open + close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [isOpen]);

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  return (
    <nav
      role="navigation"
      aria-label="Main navigation"
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled ? "glass border-b border-white/5 py-3" : "bg-transparent py-5"
      }`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="group flex items-center gap-3">
            <div className="relative h-10 w-10 shrink-0 transition-transform duration-300 group-hover:scale-110">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="Tales on 2 Wheels" className="h-full w-full object-contain" />
            </div>
            <span
              className="hidden text-xl text-white sm:inline"
              style={{ fontFamily: "var(--font-courgette), cursive" }}
            >
              Tales on 2 Wheels
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden items-center gap-1 lg:flex">
            {navLinks.map((link) => {
              const active = isActive(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 hover:bg-white/5 hover:text-white ${
                    active ? "text-white" : "text-gray-300"
                  }`}
                >
                  {link.label}
                  {active && (
                    <motion.span
                      layoutId="nav-active-pill"
                      className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-t2w-accent"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                </Link>
              );
            })}
            {user && (user.role === "superadmin" || user.role === "core_member") && (
              <Link
                href="/admin"
                aria-current={isActive(pathname, "/admin") ? "page" : undefined}
                className={`relative rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 hover:bg-white/5 hover:text-white ${
                  isActive(pathname, "/admin") ? "text-white" : "text-gray-300"
                }`}
              >
                <Shield className="mr-1 inline h-3.5 w-3.5" />
                Admin
                {isActive(pathname, "/admin") && (
                  <motion.span
                    layoutId="nav-active-pill"
                    className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-t2w-accent"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </Link>
            )}
          </div>

          {/* Desktop Actions */}
          <div className="hidden items-center gap-3 lg:flex">
            {loading ? (
              <div className="h-9 w-24 animate-pulse rounded-xl bg-t2w-surface" />
            ) : user ? (
              <UserMenu user={user} onLogout={handleLogout} />
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
            className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-300 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
            aria-label={isOpen ? "Close menu" : "Open menu"}
            aria-expanded={isOpen}
            aria-controls="mobile-menu"
          >
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        <AnimatePresence>
          {isOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => setIsOpen(false)}
                className="fixed inset-0 top-16 z-30 bg-black/40 backdrop-blur-sm lg:hidden"
                aria-hidden="true"
              />
              {/* Sheet */}
              <motion.div
                id="mobile-menu"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.22, ease: "easeOut" as const }}
                className="relative z-40 mt-4 rounded-2xl border border-t2w-border bg-t2w-surface p-4 lg:hidden"
              >
                <div className="flex flex-col gap-1">
                  {navLinks.map((link) => {
                    const active = isActive(pathname, link.href);
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        aria-current={active ? "page" : undefined}
                        onClick={() => setIsOpen(false)}
                        className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                          active
                            ? "bg-t2w-accent/10 text-t2w-accent"
                            : "text-gray-300 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        {link.label}
                        {active && <span className="h-2 w-2 rounded-full bg-t2w-accent" />}
                      </Link>
                    );
                  })}
                  {user && (user.role === "superadmin" || user.role === "core_member") && (
                    <Link
                      href="/admin"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-gray-300 transition-colors hover:bg-white/5 hover:text-white"
                    >
                      <Shield className="h-4 w-4" />
                      Admin Panel
                    </Link>
                  )}
                  <hr className="my-2 border-t2w-border" />
                  {user ? (
                    <>
                      <Link
                        href={user.linkedRiderId ? `/rider/${user.linkedRiderId}` : "/rides"}
                        onClick={() => setIsOpen(false)}
                        className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-gray-300 transition-colors hover:bg-white/5 hover:text-white"
                      >
                        <User className="h-4 w-4" />
                        My Profile &mdash; {user.name.split(" ")[0]}
                      </Link>
                      <button
                        onClick={() => {
                          setIsOpen(false);
                          handleLogout();
                        }}
                        className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-gray-300 transition-colors hover:bg-white/5 hover:text-white"
                      >
                        <LogIn className="h-4 w-4 rotate-180" />
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
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </nav>
  );
}
