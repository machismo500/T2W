import { prisma } from "@/lib/db";

/**
 * Record an entry in the activity log. Mirrors how the web client logs
 * admin actions via /api/activity-log, but now invoked server-side from
 * the new /api/v1/admin/* routes so mobile-driven changes also show up in
 * the audit feed.
 *
 * Fire-and-forget on the caller side (await but don't let failures bubble
 * up — auditing should never block a successful action). We log the
 * underlying error to Sentry-friendly console so it's still visible.
 */
export type AuditEntry = {
  action: string;
  performedBy: { id: string; name: string };
  target: { id: string; name: string };
  details?: string;
  rollbackData?: Record<string, unknown> | unknown[] | null;
};

export async function recordActivity(entry: AuditEntry): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        action: entry.action,
        performedBy: entry.performedBy.id,
        performedByName: entry.performedBy.name,
        targetId: entry.target.id,
        targetName: entry.target.name,
        details: entry.details ?? null,
        rollbackData: entry.rollbackData != null ? JSON.stringify(entry.rollbackData) : null,
      },
    });
  } catch (err) {
    console.warn("[T2W][audit] failed to record activity:", err);
  }
}
