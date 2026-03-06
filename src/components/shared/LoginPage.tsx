"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  X,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

type ModalState = "none" | "forgot" | "resetSuccess";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Forgot password state
  const [modal, setModal] = useState<ModalState>("none");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { login, resetPassword } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Login failed. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    setForgotEmail(email || "");
    setForgotError(null);
    setModal("forgot");
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotError(null);

    try {
      const tp = await resetPassword(forgotEmail);
      setTempPassword(tp);
      setCopied(false);
      setModal("resetSuccess");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setForgotError(err.message);
      } else {
        setForgotError("Password reset failed. Please try again.");
      }
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 pt-20">
      {/* Background */}
      <div className="absolute inset-0 bg-hero-pattern" />
      <div className="absolute right-0 top-1/4 h-[500px] w-[500px] rounded-full bg-t2w-accent/5 blur-[120px]" />

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="h-12 w-12 shrink-0">
              <img src="/logo.png" alt="Tales on 2 Wheels" className="h-full w-full object-contain" />
            </div>
            <span className="text-2xl text-white" style={{ fontFamily: "'Courgette', cursive" }}>
              Tales on 2 Wheels
            </span>
          </Link>
          <h1 className="mt-6 font-display text-3xl font-bold text-white">
            Welcome Back, Rider
          </h1>
          <p className="mt-2 text-t2w-muted">
            Log in to access your riding dashboard
          </p>
        </div>

        <div className="card">
          {/* Error Message */}
          {error && (
            <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Email Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-300">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-t2w-muted" />
                <input
                  type="email"
                  required
                  className="input-field !pl-10"
                  placeholder="rider@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-300">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-t2w-muted" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  className="input-field !pl-10 !pr-10"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-t2w-muted hover:text-white"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-t2w-border accent-t2w-accent"
                />
                <span className="text-sm text-t2w-muted">Remember me</span>
              </label>
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-sm text-t2w-accent hover:text-t2w-accent/80 transition-colors"
              >
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary flex w-full items-center justify-center gap-2"
            >
              {isLoading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <>
                  Login
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-t2w-muted">
          New to T2W?{" "}
          <Link
            href="/register"
            className="font-medium text-t2w-accent hover:text-t2w-accent/80 transition-colors"
          >
            Create an account
          </Link>
        </p>
      </div>

      {/* Forgot Password Modal */}
      {modal === "forgot" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-sm rounded-2xl border border-t2w-border bg-t2w-surface p-6">
            <button
              onClick={() => setModal("none")}
              className="absolute right-4 top-4 text-t2w-muted hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="mb-6 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-t2w-accent/10">
                <Lock className="h-6 w-6 text-t2w-accent" />
              </div>
              <h3 className="font-display text-lg font-bold text-white">
                Reset Password
              </h3>
              <p className="mt-1 text-sm text-t2w-muted">
                Enter your registered email to generate a temporary password
              </p>
            </div>

            {forgotError && (
              <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{forgotError}</span>
              </div>
            )}

            <form onSubmit={handleForgotSubmit} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-t2w-muted" />
                <input
                  type="email"
                  required
                  autoFocus
                  className="input-field !pl-10"
                  placeholder="Your registered email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                />
              </div>
              <button
                type="submit"
                disabled={forgotLoading}
                className="btn-primary flex w-full items-center justify-center gap-2"
              >
                {forgotLoading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <>
                    Reset Password
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Password Reset Success Modal */}
      {modal === "resetSuccess" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-sm rounded-2xl border border-t2w-border bg-t2w-surface p-6">
            <button
              onClick={() => setModal("none")}
              className="absolute right-4 top-4 text-t2w-muted hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="mb-6 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
                <CheckCircle className="h-6 w-6 text-green-400" />
              </div>
              <h3 className="font-display text-lg font-bold text-white">
                Password Reset
              </h3>
              <p className="mt-1 text-sm text-t2w-muted">
                Your temporary password for{" "}
                <span className="font-medium text-white">{forgotEmail}</span>:
              </p>
              {tempPassword && (
                <div className="mt-3 flex items-center justify-center gap-2">
                  <code className="rounded-lg bg-t2w-surface-light px-4 py-2 font-mono text-lg font-bold text-t2w-accent">
                    {tempPassword}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(tempPassword);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="rounded-lg bg-t2w-surface-light px-3 py-2 text-xs font-medium text-t2w-muted transition-colors hover:text-white"
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
              )}
              <p className="mt-3 text-xs text-t2w-muted">
                Use this password to log in. Your old password will also continue to work.
              </p>
            </div>

            <button
              onClick={() => {
                setEmail(forgotEmail);
                setPassword(tempPassword || "");
                setModal("none");
              }}
              className="btn-primary flex w-full items-center justify-center gap-2"
            >
              Login with New Password
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
