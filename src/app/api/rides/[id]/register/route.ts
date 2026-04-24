import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { computeRideStatus } from "@/lib/ride-status";
import nodemailer from "nodemailer";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildRegistrationEmailHtml(fields: {
  rideTitle: string;
  confirmationCode: string;
  riderName: string;
  email: string;
  phone: string;
  address: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  bloodGroup: string;
  referredBy: string;
  foodPreference: string;
  ridingType: string;
  vehicleModel: string;
  vehicleRegNumber: string;
  tshirtSize: string;
}): string {
  const rows = [
    ["Rider Name", fields.riderName],
    ["Email", fields.email],
    ["Phone", fields.phone],
    ["Address", fields.address],
    ["Emergency Contact", fields.emergencyContactName],
    ["Emergency Phone", fields.emergencyContactPhone],
    ["Blood Group", fields.bloodGroup],
    ["Referred By", fields.referredBy],
    ["Food Preference", fields.foodPreference],
    ["Riding Type", fields.ridingType],
    ["Vehicle", fields.vehicleModel],
    ["Reg Number", fields.vehicleRegNumber],
    ["T-Shirt Size", fields.tshirtSize],
  ].filter(([, v]) => v);

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; background: #1a1a2e; color: #ffffff; border-radius: 16px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #ff4757; margin: 0; font-size: 24px;">Tales on 2 Wheels</h1>
        <p style="color: #a0a0b0; margin-top: 8px;">Ride Registration</p>
      </div>
      <div style="background: #2a2a4a; padding: 20px; border-radius: 12px; border: 1px solid #3a3a5a; text-align: center; margin-bottom: 20px;">
        <p style="color: #a0a0b0; margin: 0 0 8px 0; font-size: 13px;">Ride</p>
        <h2 style="color: #ffffff; margin: 0; font-size: 20px;">${escapeHtml(fields.rideTitle)}</h2>
        <p style="color: #ff4757; margin: 8px 0 0 0; font-size: 14px; font-family: monospace;">Confirmation: ${escapeHtml(fields.confirmationCode)}</p>
      </div>
      <div style="background: #2a2a4a; padding: 20px; border-radius: 12px; border: 1px solid #3a3a5a;">
        <p style="color: #a0a0b0; margin: 0 0 12px 0; font-size: 13px; font-weight: bold;">Registration Details</p>
        <table style="width: 100%; border-collapse: collapse;">
          ${rows
            .map(
              ([label, value]) => `
            <tr>
              <td style="color: #a0a0b0; padding: 6px 12px 6px 0; vertical-align: top; white-space: nowrap; font-size: 13px;">${escapeHtml(label)}:</td>
              <td style="color: #ffffff; padding: 6px 0; font-size: 13px;">${escapeHtml(value)}</td>
            </tr>`
            )
            .join("")}
        </table>
      </div>
      <div style="margin-top: 20px; background: #2a2a4a; padding: 16px; border-radius: 12px; border: 1px solid #3a3a5a; text-align: center;">
        <p style="color: #ffa502; margin: 0; font-size: 13px;">⏳ Your registration is pending confirmation by the T2W team. You will be notified once confirmed.</p>
      </div>
      <hr style="border: none; border-top: 1px solid #3a3a5a; margin: 24px 0;" />
      <p style="color: #707080; font-size: 12px; text-align: center;">
        Sent by Tales on 2 Wheels &bull; Do not reply to this email
      </p>
    </div>`;
}

// POST /api/rides/[id]/register - register for a ride
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: rideId } = await params;
    const data = await req.json();

    // Verify ride exists
    const ride = await prisma.ride.findUnique({
      where: { id: rideId },
      include: {
        registrations: {
          select: { id: true, approvalStatus: true, accommodationType: true },
        },
      },
    });

    if (!ride) {
      return NextResponse.json({ error: "Ride not found" }, { status: 404 });
    }

    const dynamicStatus = computeRideStatus(ride.startDate, ride.endDate, ride.status);
    if (dynamicStatus !== "upcoming") {
      return NextResponse.json(
        { error: dynamicStatus === "ongoing"
            ? "Registration is closed — this ride has already started"
            : dynamicStatus === "completed"
            ? "Registration is closed — this ride has already ended"
            : "Registration is not available for this ride" },
        { status: 400 }
      );
    }

    // Check staggered registration schedule
    const now = new Date();
    const userRole = user.role;
    let regOpenDate: Date | null = null;
    if (userRole === "superadmin" || userRole === "core_member") {
      regOpenDate = ride.regOpenCore;
    } else if (userRole === "t2w_rider") {
      regOpenDate = ride.regOpenT2w;
    } else {
      regOpenDate = ride.regOpenRider;
    }
    if (regOpenDate && now < regOpenDate) {
      return NextResponse.json(
        { error: "Registration is not yet open for your tier. Please check back later." },
        { status: 403 }
      );
    }

    // Early capacity check (from cached ride data loaded with the ride)
    const activeRegistrations = ride.registrations.filter(
      (r) => r.approvalStatus === "pending" || r.approvalStatus === "confirmed"
    );
    const totalCapacity = ride.maxRiders + (ride.extraBedSlots ?? 0);
    if (activeRegistrations.length >= totalCapacity) {
      return NextResponse.json(
        { error: "This ride is full — no spots available" },
        { status: 400 }
      );
    }

    // Auto-assign accommodation type: first maxRiders slots are "bed", overflow slots are "extra-bed"
    const confirmedBeds = activeRegistrations.filter(
      (r) => r.accommodationType !== "extra-bed"
    ).length;
    const autoAccommodationType: "bed" | "extra-bed" =
      confirmedBeds < ride.maxRiders ? "bed" : "extra-bed";

    // Snapshot registration fields before the transaction
    const riderName = String(data.riderName || user.name || "");
    const riderEmail = String(data.email || user.email || "");
    const riderPhone = String(data.phone || "");
    const riderAddress = String(data.address || "");
    const emergencyContactName = String(data.emergencyContactName || "");
    const emergencyContactPhone = String(data.emergencyContactPhone || "");
    const bloodGroup = String(data.bloodGroup || "");
    const referredBy = String(data.referredBy || "");
    const foodPreference = String(data.foodPreference || "");
    const ridingType = String(data.ridingType || "");
    const vehicleModel = String(data.vehicleModel || "");
    const vehicleRegNumber = String(data.vehicleRegNumber || "");
    const tshirtSize = String(data.tshirtSize || "");

    // Generate a cryptographically random confirmation code
    const randomPart = randomBytes(8).toString("hex").toUpperCase();
    const confirmationCode = `T2W-${rideId.toUpperCase().slice(0, 10)}-${randomPart}`;

    // Wrap capacity re-check + insert in a transaction to prevent TOCTOU race conditions
    const registration = await prisma.$transaction(async (tx) => {
      const activeCount = await tx.rideRegistration.count({
        where: {
          rideId,
          approvalStatus: { in: ["pending", "confirmed"] },
        },
      });
      if (activeCount >= totalCapacity) {
        throw Object.assign(new Error("RIDE_FULL"), { code: "RIDE_FULL" });
      }

      return tx.rideRegistration.create({
        data: {
          userId: user.id,
          rideId,
          riderName,
          address: riderAddress,
          email: riderEmail,
          phone: riderPhone,
          emergencyContactName,
          emergencyContactPhone,
          bloodGroup,
          referredBy,
          foodPreference,
          ridingType,
          vehicleModel,
          vehicleRegNumber,
          tshirtSize,
          accommodationType: autoAccommodationType,
          agreedCancellationTerms: Boolean(data.agreedCancellationTerms),
          agreedIndemnity: Boolean(data.agreedIndemnity),
          paymentScreenshot: String(data.paymentScreenshot || ""),
          upiTransactionId: String(data.upiTransactionId || ""),
          confirmationCode,
          approvalStatus: "pending",
        },
      });
    });

    // Send registration confirmation emails (best-effort, don't block response)
    const smtpUser = (process.env.SMTP_USER || "").trim();
    const smtpPass = (process.env.SMTP_PASS || "").trim();
    const smtpFromName = (process.env.SMTP_FROM || "Tales on 2 Wheels").trim();

    if (smtpUser && smtpPass) {
      const emailHtml = buildRegistrationEmailHtml({
        rideTitle: ride.title,
        confirmationCode,
        riderName,
        email: riderEmail,
        phone: riderPhone,
        address: riderAddress,
        emergencyContactName,
        emergencyContactPhone,
        bloodGroup,
        referredBy,
        foodPreference,
        ridingType,
        vehicleModel,
        vehicleRegNumber,
        tshirtSize,
      });

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: smtpUser, pass: smtpPass },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
      });

      const recipients = [
        riderEmail, // registrant
        "taleson2wheels.official@gmail.com", // T2W official
      ].filter((e) => e && e !== smtpUser);

      // Fire-and-forget: send emails without blocking the API response
      Promise.all(
        recipients.map((to) =>
          transporter
            .sendMail({
              from: `"${smtpFromName}" <${smtpUser}>`,
              to,
              subject: `[T2W] Registration for ${ride.title} — ${confirmationCode}`,
              html: emailHtml,
            })
            .catch((err) => console.error(`[T2W] Failed to send reg email to ${to}:`, err))
        )
      ).catch(() => {});
    }

    return NextResponse.json({
      registration: {
        id: registration.id,
        confirmationCode: registration.confirmationCode,
        registeredAt: registration.registeredAt.toISOString(),
      },
      confirmationCode,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "RIDE_FULL") {
      return NextResponse.json(
        { error: "This ride is full — no spots available" },
        { status: 400 }
      );
    }
    // Handle duplicate registration (unique constraint on userId + rideId)
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "You are already registered for this ride" },
        { status: 409 }
      );
    }
    console.error("[T2W] Registration error:", error);
    return NextResponse.json(
      { error: "Failed to register for ride" },
      { status: 500 }
    );
  }
}
