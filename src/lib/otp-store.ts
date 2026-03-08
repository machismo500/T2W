// In-memory OTP store for email verification and password reset
// In production, use Redis or a database table for persistence across restarts

interface OtpEntry {
  code: string;
  expiresAt: number;
}

const emailOtps = new Map<string, OtpEntry>();
const resetOtps = new Map<string, OtpEntry>();
const resetVerified = new Map<string, number>(); // email -> expiresAt

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function cleanup(store: Map<string, OtpEntry | number>) {
  const now = Date.now();
  for (const [key, val] of store) {
    const expiry = typeof val === "number" ? val : val.expiresAt;
    if (now > expiry) store.delete(key);
  }
}

// ── Email verification OTPs (registration) ──

export function createEmailOtp(email: string): string {
  cleanup(emailOtps);
  const code = generateOtp();
  emailOtps.set(email.toLowerCase().trim(), {
    code,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
  });
  return code;
}

export function verifyEmailOtp(email: string, code: string): boolean {
  const key = email.toLowerCase().trim();
  const entry = emailOtps.get(key);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    emailOtps.delete(key);
    return false;
  }
  if (entry.code !== code.trim()) return false;
  emailOtps.delete(key);
  return true;
}

// ── Password reset OTPs ──

export function createResetOtp(email: string): string {
  cleanup(resetOtps);
  const code = generateOtp();
  resetOtps.set(email.toLowerCase().trim(), {
    code,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });
  return code;
}

export function verifyResetOtp(email: string, code: string): boolean {
  const key = email.toLowerCase().trim();
  const entry = resetOtps.get(key);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    resetOtps.delete(key);
    return false;
  }
  if (entry.code !== code.trim()) return false;
  resetOtps.delete(key);
  // Mark as verified for 5 minutes
  resetVerified.set(key, Date.now() + 5 * 60 * 1000);
  return true;
}

export function isResetVerified(email: string): boolean {
  const key = email.toLowerCase().trim();
  const expiry = resetVerified.get(key);
  if (!expiry) return false;
  if (Date.now() > expiry) {
    resetVerified.delete(key);
    return false;
  }
  return true;
}

export function clearResetVerified(email: string): void {
  resetVerified.delete(email.toLowerCase().trim());
}
