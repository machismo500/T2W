"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bike,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  User,
  Phone,
  MapPin,
  AlertCircle,
  Loader2,
  CheckCircle,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export function RegisterPage() {
  const { register, sendOtp, verifyOtp } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // step 1: basic info + email, step 2: OTP verification, step 3: riding info
  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: searchParams.get("email") || "",
    phone: "",
    password: "",
    confirmPassword: "",
    city: "",
    ridingExperience: "",
    motorcycle: "",
    agreeTerms: false,
  });

  // OTP state
  const [otpCode, setOtpCode] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [emailCheckResult, setEmailCheckResult] = useState<{
    hasAccount: boolean;
    hasRiderProfile: boolean;
    riderProfileName: string | null;
  } | null>(null);
  const [checkingEmail, setCheckingEmail] = useState(false);

  const handleChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Reset email check when email changes
    if (field === "email") {
      setEmailCheckResult(null);
    }
  };

  const handleSendOtp = async () => {
    if (!formData.email) {
      setError("Please enter your email address first");
      return;
    }
    setOtpSending(true);
    setOtpError(null);
    try {
      await sendOtp(formData.email);
      setOtpSent(true);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setOtpError(err.message);
      } else {
        setOtpError("Failed to send verification code. Please try again.");
      }
    } finally {
      setOtpSending(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode || otpCode.length < 6) {
      setOtpError("Please enter the 6-digit verification code");
      return;
    }
    setOtpSending(true);
    setOtpError(null);
    try {
      await verifyOtp(formData.email, otpCode);
      setOtpVerified(true);
      setStep(3);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setOtpError(err.message);
      } else {
        setOtpError("Verification failed. Please try again.");
      }
    } finally {
      setOtpSending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (step === 1) {
      if (formData.password.length < 6) {
        setError("Password must be at least 6 characters");
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setError("Passwords do not match");
        return;
      }
      if (!formData.phone || formData.phone.length < 10) {
        setError("Please enter a valid phone number");
        return;
      }

      // Check if email already has an account
      setCheckingEmail(true);
      try {
        const res = await fetch("/api/riders/check-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: formData.email }),
        });
        const data = await res.json();
        setEmailCheckResult(data);

        if (data.hasAccount) {
          setError("An account with this email already exists. Please log in instead.");
          setCheckingEmail(false);
          return;
        }
      } catch {
        // If check fails, proceed anyway (registration will catch duplicates)
      } finally {
        setCheckingEmail(false);
      }

      // Move to email verification step
      setStep(2);
      return;
    }

    if (step === 3) {
      if (!otpVerified) {
        setError("Please verify your email before registering");
        return;
      }

      setLoading(true);
      try {
        const { name, email, phone, password, city, ridingExperience, motorcycle } = formData;
        const { user: newUser } = await register({ name, email, phone, password, city, ridingExperience, motorcycle });
        router.push(newUser.linkedRiderId ? `/rider/${newUser.linkedRiderId}` : "/rides");
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Registration failed. Please try again.");
        }
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-24">
      <div className="absolute inset-0 bg-hero-pattern" />
      <div className="absolute left-0 top-1/3 h-[500px] w-[500px] rounded-full bg-t2w-accent/5 blur-[120px]" />

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
            Join the Ride
          </h1>
          <p className="mt-2 text-t2w-muted">
            Create your T2W account and start your journey
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8 flex items-center justify-center gap-3">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-3">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                  step >= s
                    ? "bg-t2w-accent text-white"
                    : "bg-t2w-surface text-t2w-muted"
                }`}
              >
                {s === 2 && otpVerified ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  s
                )}
              </div>
              {s < 3 && (
                <div
                  className={`h-0.5 w-8 rounded-full ${
                    step > s ? "bg-t2w-accent" : "bg-t2w-border"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <div className="mb-6 text-center text-xs text-t2w-muted">
          {step === 1 && "Step 1: Account Details"}
          {step === 2 && "Step 2: Email Verification"}
          {step === 3 && "Step 3: Riding Info"}
        </div>

        <div className="card">
          {/* Error Message */}
          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                {error}
                {error.includes("already exists") && (
                  <Link href="/login" className="ml-1 font-medium text-t2w-accent hover:underline">
                    Go to Login &rarr;
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Step 2: OTP Verification */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-t2w-accent/10">
                  <ShieldCheck className="h-6 w-6 text-t2w-accent" />
                </div>
                <h3 className="font-display text-lg font-bold text-white">
                  Verify Your Email
                </h3>
                <p className="mt-1 text-sm text-t2w-muted">
                  We&apos;ll send a verification code to{" "}
                  <span className="font-medium text-white">{formData.email}</span>
                </p>
              </div>

              {otpError && (
                <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{otpError}</span>
                </div>
              )}

              {!otpSent ? (
                <button
                  onClick={handleSendOtp}
                  disabled={otpSending}
                  className="btn-primary flex w-full items-center justify-center gap-2"
                >
                  {otpSending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Send Verification Code
                      <Mail className="h-4 w-4" />
                    </>
                  )}
                </button>
              ) : (
                <>
                  <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">
                    <CheckCircle className="mr-1.5 inline h-4 w-4" />
                    Verification code sent to {formData.email}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-300">
                      Enter 6-digit code
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      required
                      autoFocus
                      className="input-field text-center text-lg font-mono tracking-[0.5em]"
                      placeholder="000000"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={otpSending}
                      className="btn-secondary flex-1 text-sm"
                    >
                      Resend Code
                    </button>
                    <button
                      onClick={handleVerifyOtp}
                      disabled={otpSending || otpCode.length < 6}
                      className="btn-primary flex flex-1 items-center justify-center gap-2"
                    >
                      {otpSending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          Verify
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}

              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-full text-center text-sm text-t2w-muted hover:text-white transition-colors"
              >
                &larr; Back to account details
              </button>
            </div>
          )}

          {/* Step 1 and Step 3 - form */}
          {(step === 1 || step === 3) && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {step === 1 ? (
                <>
                  {emailCheckResult?.hasRiderProfile && !emailCheckResult?.hasAccount && (
                    <div className="mb-2 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">
                      <CheckCircle className="mr-1.5 inline h-4 w-4" />
                      Welcome back, {emailCheckResult.riderProfileName}! Your existing rider profile will be linked to your account.
                    </div>
                  )}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-300">
                      Full Name
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-t2w-muted" />
                      <input
                        type="text"
                        required
                        className="input-field !pl-10"
                        placeholder="Your full name"
                        value={formData.name}
                        onChange={(e) => handleChange("name", e.target.value)}
                      />
                    </div>
                  </div>

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
                        value={formData.email}
                        onChange={(e) => handleChange("email", e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-300">
                      Phone Number
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-t2w-muted" />
                      <input
                        type="tel"
                        required
                        className="input-field !pl-10"
                        placeholder="+91 98765 43210"
                        value={formData.phone}
                        onChange={(e) => handleChange("phone", e.target.value)}
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
                        placeholder="Create a strong password (min 6 chars)"
                        value={formData.password}
                        onChange={(e) =>
                          handleChange("password", e.target.value)
                        }
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

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-300">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-t2w-muted" />
                      <input
                        type="password"
                        required
                        className="input-field !pl-10"
                        placeholder="Confirm your password"
                        value={formData.confirmPassword}
                        onChange={(e) =>
                          handleChange("confirmPassword", e.target.value)
                        }
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={checkingEmail}
                    className="btn-primary flex w-full items-center justify-center gap-2"
                  >
                    {checkingEmail ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Checking...
                      </>
                    ) : (
                      <>
                        Continue
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </>
              ) : (
                <>
                  {/* Step 3 */}
                  {otpVerified && (
                    <div className="mb-2 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-2 text-sm text-green-400">
                      <CheckCircle className="mr-1.5 inline h-4 w-4" />
                      Email verified: {formData.email}
                    </div>
                  )}

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-300">
                      City
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-t2w-muted" />
                      <input
                        type="text"
                        required
                        className="input-field !pl-10"
                        placeholder="Your city"
                        value={formData.city}
                        onChange={(e) => handleChange("city", e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-300">
                      Riding Experience
                    </label>
                    <select
                      required
                      className="input-field cursor-pointer"
                      value={formData.ridingExperience}
                      onChange={(e) =>
                        handleChange("ridingExperience", e.target.value)
                      }
                    >
                      <option value="">Select experience level</option>
                      <option value="beginner">
                        Beginner (Less than 1 year)
                      </option>
                      <option value="intermediate">
                        Intermediate (1-3 years)
                      </option>
                      <option value="experienced">
                        Experienced (3-5 years)
                      </option>
                      <option value="veteran">Veteran (5+ years)</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-300">
                      Primary Motorcycle
                    </label>
                    <div className="relative">
                      <Bike className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-t2w-muted" />
                      <input
                        type="text"
                        className="input-field !pl-10"
                        placeholder="e.g., Royal Enfield Himalayan 450"
                        value={formData.motorcycle}
                        onChange={(e) =>
                          handleChange("motorcycle", e.target.value)
                        }
                      />
                    </div>
                  </div>

                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      required
                      checked={formData.agreeTerms}
                      onChange={(e) =>
                        handleChange("agreeTerms", e.target.checked)
                      }
                      className="mt-0.5 h-4 w-4 rounded border-t2w-border accent-t2w-accent"
                    />
                    <span className="text-sm text-t2w-muted">
                      I agree to the T2W{" "}
                      <Link href="/guidelines" className="text-t2w-accent hover:text-t2w-accent/80">
                        Riding Guidelines
                      </Link>{" "}
                      and community rules. I understand my registration requires
                      admin approval.
                    </span>
                  </label>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      disabled={loading}
                      className="btn-secondary flex-1"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="btn-primary flex flex-1 items-center justify-center gap-2"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Registering...
                        </>
                      ) : (
                        <>
                          Register
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-t2w-muted">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-t2w-accent hover:text-t2w-accent/80 transition-colors"
          >
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
