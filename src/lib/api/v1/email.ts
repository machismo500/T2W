import nodemailer from "nodemailer";

type OtpEmailKind = "verify" | "reset";

export async function sendOtpEmail(
  to: string,
  code: string,
  kind: OtpEmailKind,
  recipientName?: string,
): Promise<{ ok: true } | { ok: false; reason: "not_configured" | "send_failed"; message: string }> {
  const smtpUser = (process.env.SMTP_USER || "").trim();
  const smtpPass = (process.env.SMTP_PASS || "").trim();
  const smtpFromName = (process.env.SMTP_FROM || "Tales on 2 Wheels").trim();

  if (!smtpUser || !smtpPass) {
    return { ok: false, reason: "not_configured", message: "Email service is not configured." };
  }

  const subject =
    kind === "verify" ? "T2W Email Verification Code" : "T2W Password Reset Code";
  const headline =
    kind === "verify" ? "Email Verification" : "Password Reset Request";
  const intro =
    kind === "verify"
      ? "Welcome, Rider!"
      : `Hi ${recipientName || "Rider"},`;
  const message =
    kind === "verify"
      ? "Use the code below to verify your email:"
      : "You requested a password reset. Use the code below to verify your identity:";

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: smtpUser, pass: smtpPass },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });

    await transporter.sendMail({
      from: `"${smtpFromName}" <${smtpUser}>`,
      to,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #1a1a2e; color: #ffffff; border-radius: 16px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #ff4757; margin: 0; font-size: 24px;">Tales on 2 Wheels</h1>
            <p style="color: #a0a0b0; margin-top: 8px;">${headline}</p>
          </div>
          <p style="color: #e0e0e0;">${intro}</p>
          <p style="color: #a0a0b0;">${message}</p>
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

    return { ok: true };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: "send_failed", message: errMsg };
  }
}
