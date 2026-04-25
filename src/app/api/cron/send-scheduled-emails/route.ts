import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendTierAnnouncementEmails } from "@/lib/email";

type RideTier = "core" | "t2w" | "rider_guest";
type NotifyMode = "all" | "selected";

// GET /api/cron/send-scheduled-emails
// Invoked by Vercel Cron every minute. Finds overdue ScheduledEmail rows and
// dispatches tier-filtered announcement emails, then marks each job as sent.
export async function GET(req: NextRequest) {
  // Vercel automatically sends: Authorization: Bearer <CRON_SECRET>
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const now = new Date();
  const jobs = await prisma.scheduledEmail.findMany({
    where: { scheduledAt: { lte: now }, sentAt: null },
    include: {
      ride: {
        select: {
          id: true, rideNumber: true, title: true,
          startLocation: true, endLocation: true,
          startDate: true, endDate: true,
          distanceKm: true, description: true,
          posterUrl: true, fee: true, leadRider: true,
        },
      },
    },
  });

  if (jobs.length === 0) {
    return NextResponse.json({ processed: 0 });
  }

  console.log(`[T2W] Cron: processing ${jobs.length} scheduled email job(s)`);

  const results = { sent: 0, failed: 0, skipped: 0 };
  for (const job of jobs) {
    // Atomically claim the job before sending. If another cron invocation already
    // claimed it (sentAt no longer null), updateMany returns count=0 — skip to
    // prevent the duplicate email that would otherwise fire at the next minute.
    const claim = await prisma.scheduledEmail.updateMany({
      where: { id: job.id, sentAt: null },
      data: { sentAt: now },
    });
    if (claim.count === 0) {
      console.log(`[T2W] Cron: job ${job.id} already claimed, skipping`);
      results.skipped += 1;
      continue;
    }

    try {
      await sendTierAnnouncementEmails(
        job.ride,
        job.tier as RideTier,
        job.notifyMode as NotifyMode
      );
      results.sent += 1;
    } catch (err) {
      console.error(`[T2W] Cron: job ${job.id} (ride=${job.rideId}, tier=${job.tier}) failed:`, err);
      results.failed += 1;
      // sentAt is already marked — acceptable trade-off: one missed send is
      // better than spamming users with duplicate emails on retry.
    }
  }

  console.log(`[T2W] Cron complete: ${results.sent} sent, ${results.failed} failed, ${results.skipped} skipped`);
  return NextResponse.json({ processed: jobs.length, ...results });
}
