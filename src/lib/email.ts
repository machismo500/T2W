import nodemailer from "nodemailer";
import { prisma } from "@/lib/db";

function createTransporter() {
  const smtpUser = (process.env.SMTP_USER || "").trim();
  const smtpPass = (process.env.SMTP_PASS || "").trim();
  if (!smtpUser || !smtpPass) return null;
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user: smtpUser, pass: smtpPass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const transporter = createTransporter();
  if (!transporter) {
    console.error("[T2W] SMTP credentials not configured — skipping email to", to);
    return;
  }
  const smtpUser = (process.env.SMTP_USER || "").trim();
  const smtpFrom = (process.env.SMTP_FROM || "Tales on 2 Wheels").trim();
  await transporter.sendMail({
    from: `"${smtpFrom}" <${smtpUser}>`,
    to,
    subject,
    html,
  });
}

function rideAnnouncementHtml(ride: {
  id: string;
  rideNumber: string;
  title: string;
  startLocation: string;
  endLocation: string;
  startDate: Date;
  endDate: Date;
  distanceKm: number;
  description: string;
  posterUrl: string | null;
  fee: number;
  leadRider: string;
}): string {
  const BASE_URL = "https://taleson2wheels.com";
  const rideUrl = `${BASE_URL}/ride/${escapeHtml(ride.id)}`;
  const startDateStr = new Date(ride.startDate).toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  const endDateStr = new Date(ride.endDate).toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  // Only allow https:// poster URLs to prevent javascript: injection
  const safePosterUrl =
    ride.posterUrl && ride.posterUrl.startsWith("https://")
      ? ride.posterUrl
      : ride.posterUrl && ride.posterUrl.startsWith("/")
        ? BASE_URL + ride.posterUrl
        : null;

  const posterSection = safePosterUrl
    ? `<div style="margin: 0 0 28px 0; border-radius: 12px; overflow: hidden;">
        <img src="${escapeHtml(safePosterUrl)}"
             alt="${escapeHtml(ride.title)}" style="width: 100%; display: block;" />
       </div>`
    : "";

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0d0d12; color: #ffffff; border-radius: 16px; overflow: hidden;">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 32px 40px 24px; border-bottom: 3px solid #f5a623;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 4px;">
          <div style="width: 36px; height: 36px; border-radius: 50%; background: #f5a623; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 900; color: #0d0d12;">T</div>
          <span style="color: #f5a623; font-size: 14px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase;">Tales on 2 Wheels</span>
        </div>
        <h1 style="margin: 16px 0 0; font-size: 22px; color: #ffffff;">New Ride Announced!</h1>
      </div>

      <!-- Body -->
      <div style="padding: 32px 40px;">
        ${posterSection}

        <!-- Ride number + title -->
        <div style="margin-bottom: 20px;">
          <span style="background: rgba(245,166,35,0.15); color: #f5a623; padding: 4px 12px; border-radius: 8px; font-size: 13px; font-weight: 700; border: 1px solid rgba(245,166,35,0.3);">${escapeHtml(ride.rideNumber)}</span>
          <h2 style="margin: 12px 0 0; font-size: 26px; font-weight: 800; color: #ffffff; line-height: 1.2;">${escapeHtml(ride.title)}</h2>
        </div>

        <!-- Route info -->
        <div style="background: #1a1a2e; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
          <p style="margin: 0 0 10px; color: #a0a0b0; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Route</p>
          <p style="margin: 0; font-size: 20px; font-weight: 600; color: #ffffff;">
            ${escapeHtml(ride.startLocation)}
            <span style="color: #f5a623; margin: 0 8px;">→</span>
            ${escapeHtml(ride.endLocation)}
          </p>
          <p style="margin: 8px 0 0; color: #666; font-size: 14px;">${ride.distanceKm} km</p>
        </div>

        <!-- Dates + fee row -->
        <div style="display: flex; gap: 16px; margin-bottom: 20px;">
          <div style="flex: 1; background: #1a1a2e; border-radius: 12px; padding: 16px;">
            <p style="margin: 0 0 6px; color: #a0a0b0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Start</p>
            <p style="margin: 0; color: #ffffff; font-size: 14px; font-weight: 600;">${startDateStr}</p>
          </div>
          <div style="flex: 1; background: #1a1a2e; border-radius: 12px; padding: 16px;">
            <p style="margin: 0 0 6px; color: #a0a0b0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">End</p>
            <p style="margin: 0; color: #ffffff; font-size: 14px; font-weight: 600;">${endDateStr}</p>
          </div>
          <div style="background: #1a1a2e; border-radius: 12px; padding: 16px; min-width: 100px;">
            <p style="margin: 0 0 6px; color: #a0a0b0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Fee</p>
            <p style="margin: 0; color: #f5a623; font-size: 16px; font-weight: 700;">₹${ride.fee}</p>
          </div>
        </div>

        <!-- Description -->
        <p style="color: #c0c0c0; font-size: 15px; line-height: 1.6; margin-bottom: 28px;">${escapeHtml(ride.description)}</p>

        <!-- CTA -->
        <div style="text-align: center; margin-bottom: 28px;">
          <a href="${rideUrl}" style="display: inline-block; background: linear-gradient(135deg, #f5a623, #e8563d); color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 10px; font-size: 16px; font-weight: 700; letter-spacing: 0.5px;">View Ride &amp; Register →</a>
        </div>

        <hr style="border: none; border-top: 1px solid #2a2a3a; margin: 0 0 20px;" />
        <p style="color: #505060; font-size: 12px; text-align: center; margin: 0;">
          You're receiving this because you're a registered member of Tales on 2 Wheels.<br/>
          To manage notifications, visit your <a href="${BASE_URL}/profile" style="color: #f5a623;">profile settings</a>.
        </p>
      </div>

      <!-- Footer bar -->
      <div style="height: 6px; background: linear-gradient(90deg, #f5a623, #e8563d);"></div>
    </div>
  `;
}

export async function sendRideAnnouncementEmails(
  ride: {
    id: string;
    rideNumber: string;
    title: string;
    startLocation: string;
    endLocation: string;
    startDate: Date;
    endDate: Date;
    distanceKm: number;
    description: string;
    posterUrl: string | null;
    fee: number;
    leadRider: string;
  },
  notifyMode: "all" | "none" | "selected"
): Promise<void> {
  if (notifyMode === "none") return;

  const where: Record<string, unknown> = {
    isApproved: true,
    notifyRides: true,
    email: { not: "" },
  };
  if (notifyMode === "selected") {
    where.adminNotifySelected = true;
  }

  const users = await prisma.user.findMany({
    where,
    select: { email: true, name: true },
  });

  // Also include unlinked rider profiles (no User account) with notifyRides=true.
  // For "selected" mode, unlinked riders are always included when notifyRides=true
  // (they have no adminNotifySelected concept — they were added by the admin).
  const userEmails = new Set(users.map((u) => u.email.toLowerCase()));
  const unlinkedProfiles = await prisma.riderProfile.findMany({
    where: {
      notifyRides: true,
      mergedIntoId: null,
      email: { not: "" },
    },
    select: { email: true, name: true },
  });
  // Deduplicate: skip profiles whose email already covered by a User account
  const unlinkedRecipients = unlinkedProfiles.filter(
    (p) => !userEmails.has(p.email.toLowerCase())
  );

  const allRecipients = [...users, ...unlinkedRecipients];
  if (allRecipients.length === 0) return;

  const san = (s: string) => s.replace(/[\r\n]/g, " ");
  const subject = `New Ride: ${san(ride.rideNumber)} ${san(ride.title)} — ${san(ride.startLocation)} → ${san(ride.endLocation)}`;
  const html = rideAnnouncementHtml(ride);

  const results = await Promise.allSettled(
    allRecipients.map((u) => sendEmail(u.email, subject, html))
  );

  const failed = results.filter((r) => r.status === "rejected").length;
  console.log(
    `[T2W] Ride announcement emails: ${results.length - failed} sent, ${failed} failed (mode: ${notifyMode}, users: ${users.length}, profiles: ${unlinkedRecipients.length})`
  );
}
