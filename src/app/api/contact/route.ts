import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import nodemailer from "nodemailer";

// Rate-limit: track submissions by IP (in-memory, resets on deploy)
const recentSubmissions = new Map<string, number>();
const RATE_LIMIT_MS = 60_000; // 1 minute between submissions per IP

export async function POST(req: NextRequest) {
  try {
    const { name, email, subject, message } = await req.json();

    // Validate required fields
    if (!name?.trim() || !email?.trim() || !subject?.trim() || !message?.trim()) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address" },
        { status: 400 }
      );
    }

    // Basic rate limiting
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    const lastSubmission = recentSubmissions.get(ip);
    if (lastSubmission && Date.now() - lastSubmission < RATE_LIMIT_MS) {
      return NextResponse.json(
        { error: "Please wait a minute before sending another message" },
        { status: 429 }
      );
    }
    recentSubmissions.set(ip, Date.now());

    const smtpUser = (process.env.SMTP_USER || "").trim();
    const smtpPass = (process.env.SMTP_PASS || "").trim();
    const smtpFromName = (process.env.SMTP_FROM || "Tales on 2 Wheels").trim();

    if (!smtpUser || !smtpPass) {
      console.error("[T2W] SMTP credentials not configured for contact form.");
      return NextResponse.json(
        { error: "Email service is not configured. Please email us directly at Info@taleson2wheels.com" },
        { status: 503 }
      );
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: smtpUser, pass: smtpPass },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });

    // Dynamically fetch all Super Admin email addresses for CC
    const superAdmins = await prisma.user.findMany({
      where: { role: "superadmin", isApproved: true },
      select: { email: true },
    });
    const ccList = superAdmins
      .map((u) => u.email)
      .filter((e) => e && e !== smtpUser); // exclude the TO address to avoid duplicates

    // Send the contact message to the T2W team, CC all super admins
    await transporter.sendMail({
      from: `"${smtpFromName}" <${smtpUser}>`,
      to: smtpUser,
      cc: ccList.length > 0 ? ccList.join(", ") : undefined,
      replyTo: `"${name.trim()}" <${email.trim()}>`,
      subject: `[T2W Contact] ${subject.trim()}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; background: #1a1a2e; color: #ffffff; border-radius: 16px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #ff4757; margin: 0; font-size: 24px;">Tales on 2 Wheels</h1>
            <p style="color: #a0a0b0; margin-top: 8px;">New Contact Form Message</p>
          </div>
          <div style="background: #2a2a4a; padding: 20px; border-radius: 12px; border: 1px solid #3a3a5a;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="color: #a0a0b0; padding: 8px 12px 8px 0; vertical-align: top; white-space: nowrap;">Name:</td>
                <td style="color: #ffffff; padding: 8px 0; font-weight: bold;">${escapeHtml(name.trim())}</td>
              </tr>
              <tr>
                <td style="color: #a0a0b0; padding: 8px 12px 8px 0; vertical-align: top; white-space: nowrap;">Email:</td>
                <td style="color: #ffffff; padding: 8px 0;"><a href="mailto:${escapeHtml(email.trim())}" style="color: #ff4757; text-decoration: none;">${escapeHtml(email.trim())}</a></td>
              </tr>
              <tr>
                <td style="color: #a0a0b0; padding: 8px 12px 8px 0; vertical-align: top; white-space: nowrap;">Subject:</td>
                <td style="color: #ffffff; padding: 8px 0;">${escapeHtml(subject.trim())}</td>
              </tr>
            </table>
          </div>
          <div style="margin-top: 20px; padding: 20px; background: #2a2a4a; border-radius: 12px; border: 1px solid #3a3a5a;">
            <p style="color: #a0a0b0; margin: 0 0 8px 0; font-size: 13px;">Message:</p>
            <p style="color: #e0e0e0; margin: 0; white-space: pre-wrap; line-height: 1.6;">${escapeHtml(message.trim())}</p>
          </div>
          <hr style="border: none; border-top: 1px solid #3a3a5a; margin: 24px 0;" />
          <p style="color: #707080; font-size: 12px; text-align: center;">
            Sent via the T2W website contact form &bull; Reply directly to respond to the sender
          </p>
        </div>
      `,
    });

    return NextResponse.json({ success: true, message: "Message sent successfully" });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("[T2W] Contact form error:", errMsg);
    return NextResponse.json(
      { error: "Failed to send message. Please try again or email us directly at Info@taleson2wheels.com" },
      { status: 500 }
    );
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
