"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  X,
  CheckCircle,
  AlertCircle,
  KeyRound,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

// "none" = no modal; forgot flow steps: email → otp → newPassword → success
type ModalState = "none" | "forgotEmail" | "forgotOtp" | "forgotNewPassword" | "forgotSuccess";

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
  const [emailSent, setEmailSent] = useState(false);
  // OTP input (6 separate digits)
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  // New password
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  // Resend cooldown
  const [resendCooldown, setResendCooldown] = useState(0);
  const { login, sendResetOtp, verifyResetOtp, resetPassword } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const { user: loggedInUser } = await login(email, password);
      router.push(loggedInUser.linkedRiderId ? `/rider/${loggedInUser.linkedRiderId}` : "/rides");
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

  const openForgotModal = () => {
    setForgotEmail(email || "");
    setForgotError(null);
    setOtpDigits(["", "", "", "", "", ""]);
    setNewPassword("");
    setConfirmPassword("");
    setEmailSent(false);
    setModal("forgotEmail");
  };

  const closeForgotModal = () => {
    setModal("none");
    setForgotError(null);
    setForgotLoading(false);
  };

  // Step 1: Send OTP via email
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotError(null);

    try {
      const result = await sendResetOtp(forgotEmail);
      setEmailSent(result.emailSent);
      setModal("forgotOtp");
      // Start resend cooldown (60s)
      setResendCooldown(60);
      const interval = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: unknown) {
      setForgotError(err instanceof Error ? err.message : "Failed to send reset code.");
    } finally {
      setForgotLoading(false);
    }
  };

  // Handle OTP digit input
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const digit = value.slice(-1);
    const updated = [...otpDigits];
    updated[index] = digit;
    setOtpDigits(updated);
    // Auto-focus next input
    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 0) return;
    const updated = [...otpDigits];
    for (let i = 0; i < 6; i++) {
      updated[i] = pasted[i] || "";
    }
    setOtpDigits(updated);
    const focusIdx = Math.min(pasted.length, 5);
    otpRefs.current[focusIdx]?.focus();
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otpDigits.join("");
    if (code.length !== 6) {
      setForgotError("Please enter the complete 6-digit code.");
      return;
    }
    setForgotLoading(true);
    setForgotError(null);

    try {
      await verifyResetOtp(forgotEmail, code);
      setModal("forgotNewPassword");
    } catch (err: unknown) {
      setForgotError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setForgotLoading(false);
    }
  };

  // Step 3: Set new password
  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setForgotError("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setForgotError("Passwords do not match.");
      return;
    }
    setForgotLoading(true);
    setForgotError(null);

    try {
      await resetPassword(forgotEmail, newPassword);
      setModal("forgotSuccess");
    } catch (err: unknown) {
      setForgotError(err instanceof Error ? err.message : "Password reset failed.");
    } finally {
      setForgotLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setForgotLoading(true);
    setForgotError(null);
    try {
      await sendResetOtp(forgotEmail);
      setOtpDigits(["", "", "", "", "", ""]);
      otpRefs.current[0]?.focus();
      setResendCooldown(60);
      const interval = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: unknown) {
      setForgotError(err instanceof Error ? err.message : "Failed to resend code.");
    } finally {
      setForgotLoading(false);
    }
  };

  const Spinner = () => (
    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
  );

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
            <span className="text-2xl text-white" style={{ fontFamily: "var(--font-courgette), cursive" }}>
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
                onClick={openForgotModal}
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
                <Spinner />
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

      {/* ─── Step 1: Enter Email or Phone ─── */}
      {modal === "forgotEmail" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-sm rounded-2xl border border-t2w-border bg-t2w-surface p-6">
            <button onClick={closeForgotModal} className="absolute right-4 top-4 text-t2w-muted hover:text-white">
              <X className="h-5 w-5" />
            </button>

            <div className="mb-6 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-t2w-accent/10">
                <Lock className="h-6 w-6 text-t2w-accent" />
              </div>
              <h3 className="font-display text-lg font-bold text-white">Reset Password</h3>
              <p className="mt-1 text-sm text-t2w-muted">
                Enter your registered email to receive a verification code.
              </p>
            </div>

            {forgotError && (
              <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{forgotError}</span>
              </div>
            )}

            <form onSubmit={handleSendOtp} className="space-y-4">
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
              <button type="submit" disabled={forgotLoading} className="btn-primary flex w-full items-center justify-center gap-2">
                {forgotLoading ? <Spinner /> : (<>Send Verification Code <ArrowRight className="h-4 w-4" /></>)}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ─── Step 2: Enter OTP ─── */}
      {modal === "forgotOtp" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-sm rounded-2xl border border-t2w-border bg-t2w-surface p-6">
            <button onClick={closeForgotModal} className="absolute right-4 top-4 text-t2w-muted hover:text-white">
              <X className="h-5 w-5" />
            </button>

            <div className="mb-6 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-t2w-accent/10">
                <KeyRound className="h-6 w-6 text-t2w-accent" />
              </div>
              <h3 className="font-display text-lg font-bold text-white">Enter Verification Code</h3>
              <p className="mt-1 text-sm text-t2w-muted">
                {emailSent ? (
                  <>A 6-digit code has been sent to <span className="font-medium text-white">{forgotEmail}</span>. Check your inbox.</>
                ) : (
                  <>Check the browser console for your verification code (email service not configured).</>
                )}
              </p>
            </div>

            {forgotError && (
              <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{forgotError}</span>
              </div>
            )}

            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="flex justify-center gap-2" onPaste={handleOtpPaste}>
                {otpDigits.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { otpRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    autoFocus={i === 0}
                    className="h-12 w-12 rounded-xl border border-t2w-border bg-t2w-surface-light text-center font-mono text-xl font-bold text-white transition-colors focus:border-t2w-accent focus:outline-none focus:ring-1 focus:ring-t2w-accent"
                  />
                ))}
              </div>

              <p className="text-center text-xs text-t2w-muted">
                Code expires in 10 minutes
              </p>

              <button type="submit" disabled={forgotLoading} className="btn-primary flex w-full items-center justify-center gap-2">
                {forgotLoading ? <Spinner /> : (<>Verify Code <ArrowRight className="h-4 w-4" /></>)}
              </button>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => { setForgotError(null); setModal("forgotEmail"); }}
                  className="flex items-center gap-1 text-sm text-t2w-muted hover:text-white transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Change email
                </button>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0 || forgotLoading}
                  className="text-sm text-t2w-accent hover:text-t2w-accent/80 transition-colors disabled:text-t2w-muted disabled:cursor-not-allowed"
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Step 3: Set New Password ─── */}
      {modal === "forgotNewPassword" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-sm rounded-2xl border border-t2w-border bg-t2w-surface p-6">
            <button onClick={closeForgotModal} className="absolute right-4 top-4 text-t2w-muted hover:text-white">
              <X className="h-5 w-5" />
            </button>

            <div className="mb-6 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-t2w-accent/10">
                <ShieldCheck className="h-6 w-6 text-t2w-accent" />
              </div>
              <h3 className="font-display text-lg font-bold text-white">Create New Password</h3>
              <p className="mt-1 text-sm text-t2w-muted">
                Identity verified. Set a new password for <span className="font-medium text-white">{forgotEmail}</span>.
              </p>
            </div>

            {forgotError && (
              <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{forgotError}</span>
              </div>
            )}

            <form onSubmit={handleSetNewPassword} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-300">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-t2w-muted" />
                  <input
                    type={showNewPassword ? "text" : "password"}
                    required
                    minLength={6}
                    autoFocus
                    className="input-field !pl-10 !pr-10"
                    placeholder="Min. 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-t2w-muted hover:text-white"
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-300">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-t2w-muted" />
                  <input
                    type={showNewPassword ? "text" : "password"}
                    required
                    minLength={6}
                    className="input-field !pl-10"
                    placeholder="Repeat your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="mt-1 text-xs text-red-400">Passwords do not match</p>
                )}
              </div>

              <button type="submit" disabled={forgotLoading} className="btn-primary flex w-full items-center justify-center gap-2">
                {forgotLoading ? <Spinner /> : (<>Reset Password <ArrowRight className="h-4 w-4" /></>)}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ─── Step 4: Success ─── */}
      {modal === "forgotSuccess" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-sm rounded-2xl border border-t2w-border bg-t2w-surface p-6">
            <button onClick={closeForgotModal} className="absolute right-4 top-4 text-t2w-muted hover:text-white">
              <X className="h-5 w-5" />
            </button>

            <div className="mb-6 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
                <CheckCircle className="h-6 w-6 text-green-400" />
              </div>
              <h3 className="font-display text-lg font-bold text-white">Password Changed!</h3>
              <p className="mt-1 text-sm text-t2w-muted">
                Your password has been reset successfully. You can now log in with your new password.
              </p>
            </div>

            <button
              onClick={() => {
                setEmail(forgotEmail);
                setPassword("");
                closeForgotModal();
              }}
              className="btn-primary flex w-full items-center justify-center gap-2"
            >
              Back to Login
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
