import { z } from "zod";
import { prisma } from "@/lib/db";
import nodemailer from "nodemailer";
import { ApiError } from "../../errors";
import { createEmailOtp, createResetOtp } from "@/lib/otp-store";
import { SendOtpInputSchema } from "../../schemas/auth";
import { registerRoute } from "../../openapi/routes";
import { ErrorEnvelopeSchema } from "../../schemas/common";
import type { Ctx } from "../../middleware";

const SendOtpResponseSchema = z
  .object({ ok: z.literal(true), purpose: z.enum(["email_verify", "password_reset"]) })
  .openapi("SendOtpResponse");

registerRoute({
  method: "post",
  path: "/api/v1/auth/send-otp",
  summary: "Send a one-time code (email verify or password reset)",
  tags: ["auth"],
  request: { body: { schema: SendOtpInputSchema } },
  responses: {
    200: { description: "Code dispatched", schema: SendOtpResponseSchema },
    409: { description: "Account exists (verify purpose only)", schema: ErrorEnvelopeSchema },
    404: { description: "No account (reset purpose only)", schema: ErrorEnvelopeSchema },
    503: { description: "Email service unavailable", schema: ErrorEnvelopeSchema },
  },
});

export type SendOtpInput = z.infer<typeof SendOtpInputSchema>;
export type SendOtpResponse = z.infer<typeof SendOtpResponseSchema>;

async function dispatchOtpEmail(email: string, code: string, purpose: "email_verify" | "password_reset"): Promise<void> {
  const smtpUser = (process.env.SMTP_USER || "").trim();
  const smtpPass = (process.env.SMTP_PASS || "").trim();
  const smtpFromName = (process.env.SMTP_FROM || "Tales on 2 Wheels").trim();
  if (!smtpUser || !smtpPass) {
    throw new ApiError("INTERNAL", "Email service is not configured. Please contact support.");
  }
  const subject = purpose === "email_verify" ? "T2W Email Verification Code" : "T2W Password Reset Code";
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: smtpUser, pass: smtpPass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
  await transporter.sendMail({
    from: `"${smtpFromName}" <${smtpUser}>`,
    to: email,
    subject,
    html: `<p>Your T2W code is <strong>${code}</strong>. It expires in 10 minutes.</p>`,
  });
}

export async function sendOtp(input: SendOtpInput, _ctx: Ctx): Promise<SendOtpResponse> {
  if (input.purpose === "email_verify") {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw new ApiError("CONFLICT", "An account with this email already exists");
    const code = await createEmailOtp(input.email);
    await dispatchOtpEmail(input.email, code, "email_verify");
  } else {
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user) throw new ApiError("NOT_FOUND", "No account found with this email");
    const code = await createResetOtp(input.email);
    await dispatchOtpEmail(input.email, code, "password_reset");
  }
  return { ok: true, purpose: input.purpose };
}
