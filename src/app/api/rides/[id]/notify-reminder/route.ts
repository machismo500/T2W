import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { sendRideReminderEmails } from "@/lib/email";
import { notifyMany } from "@/lib/push/dispatch";
import { after } from "next/server";

// POST /api/rides/:id/notify-reminder
// Admin-triggered "don't forget to register" reminder email.
// Sends to all approved members (or notifyRides=true subset) who have not
// yet registered for this ride.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !["superadmin", "core_member"].includes(currentUser.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: rideId } = await params;
    const body = await req.json();
    const notifyMode = body.notifyMode === "selected" ? "selected" : "all";

    const ride = await prisma.ride.findUnique({
      where: { id: rideId },
      select: {
        id: true, rideNumber: true, title: true,
        startLocation: true, endLocation: true,
        startDate: true, endDate: true,
        distanceKm: true, description: true,
        posterUrl: true, fee: true, leadRider: true,
      },
    });
    if (!ride) {
      return NextResponse.json({ error: "Ride not found" }, { status: 404 });
    }

    after(async () => {
      try {
        await sendRideReminderEmails(rideId, ride, notifyMode);
      } catch (err) {
        console.error("[T2W] Reminder email error:", err);
      }
    });

    // Push notification fan-out to the same audience as the reminder email:
    // approved users with notifyRides on, optionally filtered to
    // adminNotifySelected, excluding anyone already registered.
    after(async () => {
      try {
        const registered = new Set(
          (
            await prisma.rideRegistration.findMany({
              where: { rideId, approvalStatus: { not: "rejected" } },
              select: { userId: true },
            })
          ).map((r) => r.userId),
        );

        const where: Record<string, unknown> = {
          isApproved: true,
          notifyRides: true,
          id: { notIn: Array.from(registered) },
        };
        if (notifyMode === "selected") where.adminNotifySelected = true;

        const users = await prisma.user.findMany({ where, select: { id: true } });
        if (users.length === 0) return;

        await notifyMany(
          users.map((u) => u.id),
          {
            type: "ride",
            title: `Don't forget: ${ride.title}`,
            message: `${ride.startLocation} → ${ride.endLocation} on ${new Date(ride.startDate).toLocaleDateString()}. Tap to register.`,
            data: { kind: "ride", rideId },
          },
        );
      } catch (err) {
        console.error("[T2W] Reminder push error:", err);
      }
    });

    console.log(`[T2W] Reminder queued for ride ${rideId} by ${currentUser.email} (mode=${notifyMode})`);
    return NextResponse.json({ queued: true, mode: notifyMode });
  } catch (error) {
    console.error("[T2W] Reminder endpoint error:", error);
    return NextResponse.json({ error: "Failed to send reminder" }, { status: 500 });
  }
}
