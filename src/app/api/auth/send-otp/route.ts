import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createEmailOtp } from "@/lib/otp-store";
import nodemailer from "nodemailer";

const SMTP_HOST = (process.env.SMTP_HOST || "smtp.gmail.com").trim();
const SMTP_PORT = Number((process.env.SMTP_PORT || "587").trim());
const SMTP_USER = (process.env.SMTP_USER || "").trim();
const SMTP_PASS = (process.env.SMTP_PASS || "").trim();
const SMTP_FROM_NAME = (process.env.SMTP_FROM || "Tales on 2 Wheels").trim();

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    const emailLower = (email || "").toLowerCase().trim();

    if (!emailLower || !emailLower.includes("@")) {
      return NextResponse.json(
        { error: "Please enter a valid email address" },
        { status: 400 }
      );
    }

    // Check if email already registered
    const existing = await prisma.user.findUnique({ where: { email: emailLower } });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const code = createEmailOtp(emailLower);

    // Try to send email, but don't fail if SMTP isn't configured
    if (SMTP_USER && SMTP_PASS) {
      try {
        const transporter = nodemailer.createTransport({
          host: SMTP_HOST,
          port: SMTP_PORT,
          secure: SMTP_PORT === 465,
          auth: { user: SMTP_USER, pass: SMTP_PASS },
        });

        await transporter.sendMail({
          from: `"${SMTP_FROM_NAME}" <${SMTP_USER}>`,
          to: emailLower,
          subject: "T2W Email Verification Code",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #1a1a2e; color: #ffffff; border-radius: 16px;">
              <div style="text-align: center; margin-bottom: 24px;">
                <h1 style="color: #ff4757; margin: 0; font-size: 24px;">Tales on 2 Wheels</h1>
                <p style="color: #a0a0b0; margin-top: 8px;">Email Verification</p>
              </div>
              <p style="color: #e0e0e0;">Welcome, Rider!</p>
              <p style="color: #a0a0b0;">Use the code below to verify your email:</p>
              <div style="text-align: center; margin: 32px 0;">
                <div style="display: inline-block; background: #2a2a4a; padding: 16px 32px; border-radius: 12px; border: 1px solid #3a3a5a;">
                  <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #ff4757;">${code}</span>
                </div>
              </div>
              <p style="color: #a0a0b0; font-size: 14px;">This code expires in <strong style="color: #ffffff;">10 minutes</strong>.</p>
              <hr style="border: none; border-top: 1px solid #3a3a5a; margin: 24px 0;" />
              <p style="color: #707080; font-size: 12px; text-align: center;">Tales on 2 Wheels &bull; Bangalore, India</p>
            </div>
          `,
        });
      } catch (emailErr) {
        console.warn("[T2W] Failed to send verification email:", emailErr);
        // Log OTP to console as fallback
        console.info(`[T2W] OTP for ${emailLower}: ${code}`);
      }
    } else {
      console.info(`[T2W] SMTP not configured. OTP for ${emailLower}: ${code}`);
    }

    return NextResponse.json({
      success: true,
      message: `Verification code sent to ${email}`,
    });
  } catch (error) {
    console.error("[T2W] Send OTP error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
