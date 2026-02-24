"use client";

import { useState } from "react";
import Link from "next/link";
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
  CheckCircle,
} from "lucide-react";

export function RegisterPage() {
  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    city: "",
    ridingExperience: "",
    motorcycle: "",
    agreeTerms: false,
  });
  const [registered, setRegistered] = useState(false);

  const handleChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) {
      setStep(2);
    } else {
      setRegistered(true);
    }
  };

  if (registered) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 pt-20">
        <div className="absolute inset-0 bg-hero-pattern" />
        <div className="relative w-full max-w-md text-center">
          <div className="card">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-400/10">
              <CheckCircle className="h-10 w-10 text-green-400" />
            </div>
            <h1 className="font-display text-2xl font-bold text-white">
              Registration Submitted!
            </h1>
            <p className="mt-3 text-t2w-muted">
              Your registration is pending approval. A T2W admin will review and
              approve your account. You&apos;ll receive an email once approved.
            </p>
            <p className="mt-4 text-sm text-t2w-muted">
              Approval usually takes 24-48 hours.
            </p>
            <Link href="/" className="btn-primary mt-6 inline-block">
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-24">
      <div className="absolute inset-0 bg-hero-pattern" />
      <div className="absolute left-0 top-1/3 h-[500px] w-[500px] rounded-full bg-t2w-accent/5 blur-[120px]" />

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
            Join the Ride
          </h1>
          <p className="mt-2 text-t2w-muted">
            Create your T2W account and start your journey
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8 flex items-center justify-center gap-3">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
              step >= 1
                ? "bg-t2w-accent text-white"
                : "bg-t2w-surface text-t2w-muted"
            }`}
          >
            1
          </div>
          <div
            className={`h-0.5 w-12 rounded-full ${
              step >= 2 ? "bg-t2w-accent" : "bg-t2w-border"
            }`}
          />
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
              step >= 2
                ? "bg-t2w-accent text-white"
                : "bg-t2w-surface text-t2w-muted"
            }`}
          >
            2
          </div>
        </div>

        <div className="card">
          {/* Social Registration */}
          {step === 1 && (
            <>
              <div className="space-y-3">
                <button className="flex w-full items-center justify-center gap-3 rounded-xl border border-t2w-border bg-t2w-surface-light py-3 text-sm font-medium text-white transition-all hover:border-t2w-accent/50">
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
                  Sign up with Google
                </button>
                <button className="flex w-full items-center justify-center gap-3 rounded-xl border border-t2w-border bg-t2w-surface-light py-3 text-sm font-medium text-white transition-all hover:border-t2w-accent/50">
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="#1877F2"
                  >
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                  Sign up with Facebook
                </button>
              </div>

              <div className="my-6 flex items-center gap-4">
                <div className="h-px flex-1 bg-t2w-border" />
                <span className="text-xs text-t2w-muted">
                  or register with email
                </span>
                <div className="h-px flex-1 bg-t2w-border" />
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {step === 1 ? (
              <>
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
                      placeholder="Create a strong password"
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

                <button
                  type="submit"
                  className="btn-primary flex w-full items-center justify-center gap-2"
                >
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
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
                    <a href="#" className="text-t2w-accent">
                      Terms of Service
                    </a>{" "}
                    and{" "}
                    <a href="#" className="text-t2w-accent">
                      Privacy Policy
                    </a>
                    . I understand my registration requires admin approval.
                  </span>
                </label>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="btn-secondary flex-1"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="btn-primary flex flex-1 items-center justify-center gap-2"
                  >
                    Register
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </>
            )}
          </form>
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
