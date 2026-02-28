"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bike,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  X,
  CheckCircle,
  AlertCircle,
  Copy,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

type ModalState = "none" | "social" | "forgot" | "resetSuccess";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [modal, setModal] = useState<ModalState>("none");
  const [socialProvider, setSocialProvider] = useState<"Google" | "Facebook">("Google");
  const [socialEmail, setSocialEmail] = useState("");
  const [socialLoading, setSocialLoading] = useState(false);
  const [socialError, setSocialError] = useState<string | null>(null);

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState("");
  const [copied, setCopied] = useState(false);

  const { login, loginByEmail, resetPassword } = useAuth();
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

  const handleSocialLogin = (provider: "Google" | "Facebook") => {
    setSocialProvider(provider);
    setSocialEmail("");
    setSocialError(null);
    setModal("social");
  };

  const handleSocialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSocialLoading(true);
    setSocialError(null);

    try {
      await loginByEmail(socialEmail);
      router.push("/dashboard");
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "NO_ACCOUNT") {
        setSocialError(
          "No account found with this email. Redirecting to registration..."
        );
        setTimeout(() => {
          router.push(`/register?email=${encodeURIComponent(socialEmail)}`);
        }, 1500);
      } else {
        setSocialError("Login failed. Please try again.");
      }
    } finally {
      setSocialLoading(false);
    }
  };

  const handleForgotPassword = () => {
    setForgotEmail(email || "");
    setForgotError(null);
    setTempPassword("");
    setModal("forgot");
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotError(null);

    try {
      const newPass = await resetPassword(forgotEmail);
      setTempPassword(newPass);
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

  const handleCopyPassword = () => {
    navigator.clipboard.writeText(tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUseNewPassword = () => {
    setEmail(forgotEmail);
    setPassword(tempPassword);
    setModal("none");
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
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-t2w-accent to-red-600">
              <Bike className="h-6 w-6 text-white" />
            </div>
            <span className="font-display text-2xl font-bold text-white">
              T2W
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
          {/* Social Login */}
          <div className="space-y-3">
            <button
              onClick={() => handleSocialLogin("Google")}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-t2w-border bg-t2w-surface-light py-3 text-sm font-medium text-white transition-all hover:border-t2w-accent/50 hover:bg-t2w-surface"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </button>
            <button
              onClick={() => handleSocialLogin("Facebook")}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-t2w-border bg-t2w-surface-light py-3 text-sm font-medium text-white transition-all hover:border-t2w-accent/50 hover:bg-t2w-surface"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="#1877F2">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              Continue with Facebook
            </button>
          </div>

          {/* Divider */}
          <div className="my-6 flex items-center gap-4">
            <div className="h-px flex-1 bg-t2w-border" />
            <span className="text-xs text-t2w-muted">or continue with email</span>
            <div className="h-px flex-1 bg-t2w-border" />
          </div>

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

      {/* ── Social Login Modal ── */}
      {modal === "social" && (
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
                {socialProvider === "Google" ? (
                  <svg className="h-6 w-6" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                ) : (
                  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="#1877F2">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                )}
              </div>
              <h3 className="font-display text-lg font-bold text-white">
                Sign in with {socialProvider}
              </h3>
              <p className="mt-1 text-sm text-t2w-muted">
                Enter the email linked to your {socialProvider} account
              </p>
            </div>

            {socialError && (
              <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{socialError}</span>
              </div>
            )}

            <form onSubmit={handleSocialSubmit} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-t2w-muted" />
                <input
                  type="email"
                  required
                  autoFocus
                  className="input-field !pl-10"
                  placeholder={`Your ${socialProvider} email`}
                  value={socialEmail}
                  onChange={(e) => setSocialEmail(e.target.value)}
                />
              </div>
              <button
                type="submit"
                disabled={socialLoading}
                className="btn-primary flex w-full items-center justify-center gap-2"
              >
                {socialLoading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <>
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Forgot Password Modal ── */}
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
                Enter your email to receive a new password
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

      {/* ── Password Reset Success Modal ── */}
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
                Password Reset!
              </h3>
              <p className="mt-1 text-sm text-t2w-muted">
                Your new temporary password is below. Use it to log in, then
                change it from your profile settings.
              </p>
            </div>

            <div className="mb-4 flex items-center gap-2 rounded-xl border border-t2w-border bg-t2w-bg px-4 py-3">
              <code className="flex-1 text-center font-mono text-lg font-bold tracking-wider text-t2w-accent">
                {tempPassword}
              </code>
              <button
                onClick={handleCopyPassword}
                className="shrink-0 rounded-lg p-2 text-t2w-muted transition-colors hover:bg-t2w-surface-light hover:text-white"
                title="Copy password"
              >
                {copied ? (
                  <CheckCircle className="h-4 w-4 text-green-400" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>

            <button
              onClick={handleUseNewPassword}
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
