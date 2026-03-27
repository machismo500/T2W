// Database-backed OTP store for email verification and password reset
// Works correctly on serverless platforms (Vercel) where in-memory state is not shared

import { randomInt } from "crypto";
import { prisma } from "@/lib/db";

function generateOtp(): string {
  return String(randomInt(100000, 1000000));
}

// ── Email verification OTPs (registration) ──

export async function createEmailOtp(email: string): Promise<string> {
  const key = email.toLowerCase().trim();
  const code = generateOtp();

  // Delete any existing OTPs for this email/type
  await prisma.otp.deleteMany({ where: { email: key, type: "email_verify" } });

  await prisma.otp.create({
    data: {
      email: key,
      code,
      type: "email_verify",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    },
  });

  return code;
}

export async function verifyEmailOtp(email: string, code: string): Promise<boolean> {
  const key = email.toLowerCase().trim();

  const entry = await prisma.otp.findFirst({
    where: { email: key, type: "email_verify", code: code.trim() },
  });

  if (!entry) return false;

  // Delete the OTP regardless (single-use)
  await prisma.otp.delete({ where: { id: entry.id } });

  if (new Date() > entry.expiresAt) return false;

  return true;
}

// ── Password reset OTPs ──

export async function createResetOtp(email: string): Promise<string> {
  const key = email.toLowerCase().trim();
  const code = generateOtp();

  // Delete any existing reset OTPs for this email
  await prisma.otp.deleteMany({ where: { email: key, type: "password_reset" } });

  await prisma.otp.create({
    data: {
      email: key,
      code,
      type: "password_reset",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    },
  });

  return code;
}

export async function verifyResetOtp(email: string, code: string): Promise<boolean> {
  const key = email.toLowerCase().trim();

  const entry = await prisma.otp.findFirst({
    where: { email: key, type: "password_reset", code: code.trim() },
  });

  if (!entry) return false;

  if (new Date() > entry.expiresAt) {
    await prisma.otp.delete({ where: { id: entry.id } });
    return false;
  }

  // Mark as verified (don't delete yet — needed for reset-password step)
  await prisma.otp.update({
    where: { id: entry.id },
    data: { verified: true, expiresAt: new Date(Date.now() + 5 * 60 * 1000) },
  });

  return true;
}

export async function isResetVerified(email: string): Promise<boolean> {
  const key = email.toLowerCase().trim();

  const entry = await prisma.otp.findFirst({
    where: { email: key, type: "password_reset", verified: true },
  });

  if (!entry) return false;

  if (new Date() > entry.expiresAt) {
    await prisma.otp.delete({ where: { id: entry.id } });
    return false;
  }

  return true;
}

export async function clearResetVerified(email: string): Promise<void> {
  const key = email.toLowerCase().trim();
  await prisma.otp.deleteMany({ where: { email: key, type: "password_reset" } });
}
